// src/lib/vatRecap.js
// Calcul recap TVA (collectee / deductible) a partir des lignes de factures et factures fournisseurs.
// Approche: on s'appuie sur les taux stockes ligne par ligne (vatRate) sinon fallback sur invoice.vat / incomingInvoice.vat.

import prisma from './prisma.js';

function monthKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function normalizeDate(d, end=false) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  if (end) dt.setHours(23,59,59,999);
  else dt.setHours(0,0,0,0);
  return dt;
}

function resolveCompanyId(companyId) {
  if (companyId) return companyId;
  const envId = (process.env.DEFAULT_COMPANY_ID || '').trim();
  return envId || null;
}

// rows: { period, direction, rate, base, vat }
export async function computeVatRecap({
  companyId = null,
  from,
  to,
  granularity = 'month',
  includeZero = false
}) {
  const scopedCompanyId = resolveCompanyId(companyId);
  if (!scopedCompanyId) {
    throw new Error('companyId requis (ou DEFAULT_COMPANY_ID)');
  }

  const fromDate = normalizeDate(from) || new Date(new Date().getFullYear(), 0, 1);
  const toDate = normalizeDate(to, true) || new Date();

  const invoiceLines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { issueDate: { gte: fromDate, lte: toDate }, companyId: scopedCompanyId }
    },
    include: { invoice: { select: { issueDate: true, vat: true } } }
  });

  const incomingLines = await prisma.incomingInvoiceLine.findMany({
    where: {
      incomingInvoice: {
        receiptDate: { gte: fromDate, lte: toDate },
        companyId: scopedCompanyId
      }
    },
    include: { incomingInvoice: { select: { receiptDate: true, vat: true } } }
  });

  const buckets = new Map();

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
  rows = rows.map(r => ({
    period: r.period,
    direction: r.direction,
    rate: r.rate,
    ratePercent: +(r.rate * 100),
    base: +r.base.toFixed(2),
    vat: +r.vat.toFixed(2)
  }));
  if (!includeZero) rows = rows.filter(r => r.vat !== 0 || r.base !== 0);

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
