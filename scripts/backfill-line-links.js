// Backfill des transactions existantes pour lier invoiceLineId / incomingInvoiceLineId
// Hypothèse: description transaction générée ancienne forme (Vente facture XXX / Achat facture XXX)
// On tente de faire correspondre par (invoiceId, accountId, amount) unique.
// Usage: node scripts/backfill-line-links.js --dry (pour simuler)

import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');

async function backfillSales() {
  const txs = await prisma.transaction.findMany({
    where: { kind: 'SALE', invoiceLineId: null },
    orderBy: { invoiceId: 'asc' }
  });
  let updated = 0;
  for (const t of txs) {
    if (!t.invoiceId) continue;
    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId: t.invoiceId } });
    // Chercher une ligne unique même montant & compte
    const candidates = lines.filter(l => Number(l.lineTotal) === Number(t.amount) && l.accountId === t.accountId);
    if (candidates.length === 1) {
      if (!dry) {
        await prisma.transaction.update({ where: { id: t.id }, data: { invoiceLineId: candidates[0].id, description: candidates[0].description } });
      }
      updated++;
    }
  }
  return updated;
}

async function backfillPurchases() {
  const txs = await prisma.transaction.findMany({
    where: { kind: 'PURCHASE', incomingInvoiceLineId: null },
    orderBy: { incomingInvoiceId: 'asc' }
  });
  let updated = 0;
  for (const t of txs) {
    if (!t.incomingInvoiceId) continue;
    const lines = await prisma.incomingInvoiceLine.findMany({ where: { incomingInvoiceId: t.incomingInvoiceId } });
    const candidates = lines.filter(l => Number(l.lineTotal) === Number(t.amount) && l.accountId === t.accountId);
    if (candidates.length === 1) {
      if (!dry) {
        await prisma.transaction.update({ where: { id: t.id }, data: { incomingInvoiceLineId: candidates[0].id, description: candidates[0].description } });
      }
      updated++;
    }
  }
  return updated;
}

async function run() {
  const sales = await backfillSales();
  const purchases = await backfillPurchases();
  console.log(`Backfill terminé (${dry ? 'simulation' : 'appliqué'}): SALES liés = ${sales}, PURCHASE liés = ${purchases}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
