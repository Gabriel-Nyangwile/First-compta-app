#!/usr/bin/env node
/**
 * Analyse rapide des formats de numéros de facture afin de confirmer quels patterns existent.
 * Génère un résumé JSON sur stdout.
 */
import prisma from '../src/lib/prisma.js';

function classify(num) {
  if (!num) return 'EMPTY';
  if (/^INV-\d{4}-\d{4,}$/.test(num)) return 'INV_HYPHEN';
  if (/^INV-\d{8,15}$/.test(num)) return 'INV_COMPACT';
    // Pattern supposé: Numero-YYYY/xxxx
    if (/^Numero-\d{4}\//.test(num)) return 'NUMERO_YEAR_SLASH';
  if (/^INV-/.test(num)) return 'INV_OTHER';
  return 'OTHER';
}

(async () => {
  const invoices = await prisma.invoice.findMany({ select: { invoiceNumber: true }, take: 5000 });
  const counts = {};
  const samples = {};
  for (const inv of invoices) {
    const key = classify(inv.invoiceNumber);
    counts[key] = (counts[key] || 0) + 1;
    if (!samples[key]) samples[key] = [];
    if (samples[key].length < 5) samples[key].push(inv.invoiceNumber);
  }
  console.log(JSON.stringify({ total: invoices.length, counts, samples }, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
