#!/usr/bin/env node
/*
  Script: check-vat-ledger.js
  Objectif:
    Vérifier l'intégrité des écritures TVA multi-taux pour les factures clients et fournisseurs.
  Contrôles:
    - Pour chaque facture client (Invoice):
        * Regrouper lignes par vatRate (ou fallback invoice.vat si ligne vatRate null)
        * Recalculer base et montant TVA théorique = base * taux
        * Comparer avec transactions kind=VAT_COLLECTED (une par taux attendu)
        * Vérifier somme bases == invoice.totalAmountHt (±0.01) et somme TVA == invoice.vatAmount (±0.01)
    - Pour chaque facture fournisseur (IncomingInvoice): idem avec VAT_DEDUCTIBLE
  Sorties:
    - Liste des anomalies; exit code 1 si anomalies.

  Utilisation:
    node scripts/check-vat-ledger.js [--limit N] [--details]
*/
import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const opts = { limit: null, details: false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i+1]) { opts.limit = parseInt(args[i+1],10); i++; }
  else if (args[i] === '--details') opts.details = true;
}

function toNumber(dec) { if (dec == null) return 0; return Number(dec); }
function near(a,b,eps=0.01){ return Math.abs(a-b) <= eps; }

async function checkClientInvoices() {
  const invoices = await prisma.invoice.findMany({
    take: opts.limit || undefined,
    include: { invoiceLines: true, transactions: true }
  });
  const anomalies = [];
  for (const inv of invoices) {
    const buckets = new Map(); // rate -> { base, vat }
    for (const l of inv.invoiceLines) {
      const rate = l.vatRate != null ? Number(l.vatRate) : Number(inv.vat);
      const base = toNumber(l.lineTotal);
      const vat = base * rate;
      const key = rate.toFixed(2);
      const b = buckets.get(key) || { base:0, vat:0 };
      b.base += base; b.vat += vat; buckets.set(key,b);
    }
    const txVat = inv.transactions.filter(t => t.kind === 'VAT_COLLECTED');
    // Index transactions by rate inferred from description pattern 'TVA xx%'
    const txByRate = new Map();
    for (const t of txVat) {
      const m = t.description?.match(/TVA\s+(\d+(?:[.,]\d+)?)%/i);
      if (m) {
        const pct = m[1].replace(',','.');
        const rate = (Number(pct)/100).toFixed(2);
        txByRate.set(rate, t);
      }
    }
    // Validations
    let baseSum = 0, vatSum = 0;
    for (const [r,b] of buckets) { baseSum += b.base; vatSum += b.vat; }
    const baseOk = near(baseSum, Number(inv.totalAmountHt));
    const vatOk = near(vatSum, Number(inv.vatAmount));
    // Check each bucket has corresponding VAT transaction
    const missingRates = [];
    for (const rate of buckets.keys()) { if (!txByRate.has(rate)) missingRates.push(rate); }
    if (!baseOk || !vatOk || missingRates.length) {
      anomalies.push({ type:'CLIENT', invoiceNumber: inv.invoiceNumber, baseOk, vatOk, missingRates, expectedBuckets:[...buckets.entries()].map(([r,b])=>({rate:r,base:b.base,vat:b.vat})) });
    } else if (opts.details) {
      console.log(`[OK] CLIENT ${inv.invoiceNumber} (${buckets.size} taux)`);
    }
  }
  return anomalies;
}

async function checkSupplierInvoices() {
  const invoices = await prisma.incomingInvoice.findMany({
    take: opts.limit || undefined,
    include: { lines: true, transactions: true }
  });
  const anomalies = [];
  for (const inv of invoices) {
    const buckets = new Map();
    for (const l of inv.lines) {
      const rate = l.vatRate != null ? Number(l.vatRate) : Number(inv.vat);
      const base = toNumber(l.lineTotal);
      const vat = base * rate;
      const key = rate.toFixed(2);
      const b = buckets.get(key) || { base:0, vat:0 }; b.base += base; b.vat += vat; buckets.set(key,b);
    }
    const txVat = inv.transactions.filter(t => t.kind === 'VAT_DEDUCTIBLE');
    const txByRate = new Map();
    for (const t of txVat) {
      const m = t.description?.match(/TVA\s+déductible\s+(\d+(?:[.,]\d+)?)%/i);
      if (m) {
        const pct = m[1].replace(',','.');
        const rate = (Number(pct)/100).toFixed(2);
        txByRate.set(rate, t);
      }
    }
    let baseSum=0, vatSum=0; for (const [,b] of buckets) { baseSum+=b.base; vatSum+=b.vat; }
    const baseOk = near(baseSum, Number(inv.totalAmountHt));
    const vatOk = near(vatSum, Number(inv.vatAmount));
    const missingRates = [];
    for (const rate of buckets.keys()) if (!txByRate.has(rate)) missingRates.push(rate);
    if (!baseOk || !vatOk || missingRates.length) {
      anomalies.push({ type:'SUPPLIER', entryNumber: inv.entryNumber, baseOk, vatOk, missingRates, expectedBuckets:[...buckets.entries()].map(([r,b])=>({rate:r,base:b.base,vat:b.vat})) });
    } else if (opts.details) {
      console.log(`[OK] SUPPLIER ${inv.entryNumber} (${buckets.size} taux)`);
    }
  }
  return anomalies;
}

(async () => {
  try {
    const clientAnoms = await checkClientInvoices();
    const supplierAnoms = await checkSupplierInvoices();
    const total = clientAnoms.length + supplierAnoms.length;
    if (total === 0) {
      console.log('✅ Aucune anomalie TVA détectée.');
      process.exit(0);
    }
    console.log(`❌ ${total} anomalie(s) TVA:`);
    if (clientAnoms.length) {
      console.log('\n-- Factures clients --');
      for (const a of clientAnoms) console.log(JSON.stringify(a, null, 2));
    }
    if (supplierAnoms.length) {
      console.log('\n-- Factures fournisseurs --');
      for (const a of supplierAnoms) console.log(JSON.stringify(a, null, 2));
    }
    process.exit(1);
  } catch (e) {
    console.error('Erreur script check-vat-ledger:', e);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
