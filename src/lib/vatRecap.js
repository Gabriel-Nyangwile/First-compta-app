// src/lib/vatRecap.js
// Calcul récap TVA (collectée / déductible) à partir des lignes de factures et factures fournisseurs.
// Approche: on s'appuie sur les taux stockés ligne par ligne (vatRate) sinon fallback sur invoice.vat / incomingInvoice.vat.
// Permet d'éviter les ambiguïtés d'anciennes écritures agrégées.

import prisma from './prisma.js';

function monthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function normalizeDate(d, end=false) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  if (end) {
    dt.setHours(23,59,59,999);
  } else {
    dt.setHours(0,0,0,0);
  }
  return dt;
}

// rows: { period, direction, rate, base, vat }
export async function computeVatRecap({ from, to, granularity='month', includeZero=false }) {
  const fromDate = normalizeDate(from) || new Date(new Date().getFullYear(), 0, 1);
  const toDate = normalizeDate(to, true) || new Date();

  // Récupérer lignes de factures clients
  const invoiceLines = await prisma.invoiceLine.findMany({
    where: { invoice: { issueDate: { gte: fromDate, lte: toDate } } },
    include: { invoice: { select: { issueDate: true, vat: true } } }
  });
  // Lignes factures fournisseurs
  const incomingLines = await prisma.incomingInvoiceLine.findMany({
    where: { incomingInvoice: { receiptDate: { gte: fromDate, lte: toDate } } },
    include: { incomingInvoice: { select: { receiptDate: true, vat: true } } }
  });

  const buckets = new Map(); // key = period|direction|rate -> { base, vat }

  function add(direction, date, rate, base) {
    const r = rate != null ? Number(rate) : 0;
    const baseNum = Number(base) || 0;
    const vat = +(baseNum * r);
    const period = granularity === 'month' ? monthKey(date) : 'ALL';
    const key = period + '|' + direction + '|' + r.toFixed(2);
    const obj = buckets.get(key) || { period, direction, rate: r, base: 0, vat: 0 };
    obj.base += baseNum;
    obj.vat += vat;
    buckets.set(key, obj);
  }

  for (const l of invoiceLines) {
    const date = new Date(l.invoice.issueDate);
    const rate = l.vatRate != null ? l.vatRate : l.invoice.vat;
    add('COLLECTED', date, rate, l.lineTotal);
  }
  for (const l of incomingLines) {
    const date = new Date(l.incomingInvoice.receiptDate);
    const rate = l.vatRate != null ? l.vatRate : l.incomingInvoice.vat;
    add('DEDUCTIBLE', date, rate, l.lineTotal);
  }

  let rows = [...buckets.values()];
  // Arrondir et filtrer
  rows = rows.map(r => ({
    period: r.period,
    direction: r.direction,
    rate: r.rate,
    ratePercent: +(r.rate * 100),
    base: +r.base.toFixed(2),
    vat: +r.vat.toFixed(2)
  }));
  if (!includeZero) rows = rows.filter(r => r.vat !== 0 || r.base !== 0);

  // Tri: period asc, direction (COLLECTED avant DEDUCTIBLE), rate asc
  rows.sort((a,b) => {
    if (a.period !== b.period) return a.period.localeCompare(b.period);
    if (a.direction !== b.direction) return a.direction.localeCompare(b.direction);
    return a.rate - b.rate;
  });

  const totals = rows.reduce((acc,r)=>{
    if (r.direction === 'COLLECTED') { acc.collectedBase += r.base; acc.collectedVat += r.vat; }
    else { acc.deductibleBase += r.base; acc.deductibleVat += r.vat; }
    return acc;
  }, { collectedBase:0, collectedVat:0, deductibleBase:0, deductibleVat:0, balanceVat:0 });
  totals.balanceVat = +(totals.collectedVat - totals.deductibleVat).toFixed(2);

  return { from: fromDate, to: toDate, granularity, rows, totals };
}
