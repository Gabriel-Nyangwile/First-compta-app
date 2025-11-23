#!/usr/bin/env node
/**
 * Reset application data (soft or full) while preserving schema.
 *
 * Soft reset (default): wipes transactional & master dynamic data (clients, suppliers, invoices, incoming invoices,
 * transactions, treasury movements, authorizations, bank advices) but keeps the chart of accounts and money accounts
 * so existing account references remain intact.
 *
 * Full reset (--full): additionally deletes accounts & money accounts so you can re-import a fresh plan comptable.
 * After a full reset run: `node scripts/import-accounts.js`.
 *
 * SAFETY: Requires --force OR setting env RESET_CONFIRM=YES.
 *
 * Usage examples:
 *   node scripts/reset-data.js --soft --force
 *   node scripts/reset-data.js --full --force
 *   RESET_CONFIRM=YES node scripts/reset-data.js --full
 */
import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const isFull = args.includes('--full');
const isSoft = args.includes('--soft');
const forced = args.includes('--force') || process.env.RESET_CONFIRM === 'YES';

if (!forced) {
  console.error('\n[ABORT] Confirmation manquante. Ajoutez --force ou RESET_CONFIRM=YES.');
  process.exit(1);
}

async function timed(label, fn) {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;
  return { label, ms, result };
}

async function main() {
  const mode = isFull ? 'FULL' : 'SOFT';
  if (isFull && isSoft) {
    console.warn('[WARN] Les options --full et --soft sont mutuellement exclusives. Utilisation de --full.');
  }
  console.log(`\n=== RESET (${mode}) DÉMARRÉ ===`);

  // Deletion order chosen to respect FK constraints.
  const steps = [];
  // Core accounting & treasury first
  steps.push(await timed('transaction.deleteMany', () => prisma.transaction.deleteMany()));
  steps.push(await timed('paymentInvoiceLink.deleteMany', () => prisma.paymentInvoiceLink.deleteMany()));
  steps.push(await timed('payment.deleteMany', () => prisma.payment.deleteMany()));
  // Stock & purchasing dependent movements (remove before lines referencing them)
  steps.push(await timed('stockMovement.deleteMany', () => prisma.stockMovement.deleteMany()));
  // Lines referencing invoices / purchase / receipts / returns
  steps.push(await timed('invoiceLine.deleteMany', () => prisma.invoiceLine.deleteMany()));
  steps.push(await timed('incomingInvoiceLine.deleteMany', () => prisma.incomingInvoiceLine.deleteMany()));
  steps.push(await timed('purchaseOrderLine.deleteMany', () => prisma.purchaseOrderLine.deleteMany()));
  steps.push(await timed('goodsReceiptLine.deleteMany', () => prisma.goodsReceiptLine.deleteMany()));
  steps.push(await timed('returnOrderLine.deleteMany', () => prisma.returnOrderLine.deleteMany()));
  // Higher level documents
  steps.push(await timed('returnOrder.deleteMany', () => prisma.returnOrder.deleteMany()));
  steps.push(await timed('goodsReceipt.deleteMany', () => prisma.goodsReceipt.deleteMany()));
  steps.push(await timed('purchaseOrderStatusLog.deleteMany', () => prisma.purchaseOrderStatusLog.deleteMany()));
  steps.push(await timed('purchaseOrder.deleteMany', () => prisma.purchaseOrder.deleteMany()));
  // Treasury & advice
  steps.push(await timed('moneyMovement.deleteMany', () => prisma.moneyMovement.deleteMany()));
  steps.push(await timed('bankAdvice.deleteMany', () => prisma.bankAdvice.deleteMany()));
  steps.push(await timed('treasuryAuthorization.deleteMany', () => prisma.treasuryAuthorization.deleteMany()));
  // Invoices (client & supplier) after lines removed
  steps.push(await timed('invoice.deleteMany', () => prisma.invoice.deleteMany()));
  steps.push(await timed('incomingInvoice.deleteMany', () => prisma.incomingInvoice.deleteMany()));
  // Lettering referencing invoices/suppliers
  steps.push(await timed('lettering.deleteMany', () => prisma.lettering.deleteMany()));
  // Parties
  steps.push(await timed('client.deleteMany', () => prisma.client.deleteMany()));
  steps.push(await timed('supplier.deleteMany', () => prisma.supplier.deleteMany()));
  // Money accounts last (may be referenced by movements already removed)
  steps.push(await timed('moneyAccount.deleteMany', () => prisma.moneyAccount.deleteMany()));

  if (isFull) {
    steps.push(await timed('account.deleteMany', () => prisma.account.deleteMany()));
    // Optionally also wipe users if desired (commented out by default):
    // steps.push(await timed('user.deleteMany', () => prisma.user.deleteMany()));
  }

  console.log('\nRésumé suppressions:');
  for (const s of steps) {
    const count = s.result?.count ?? '?';
    console.log(` - ${s.label} => ${count} (${s.ms} ms)`);
  }

  console.log(`\n=== RESET (${mode}) TERMINÉ ===`);
  if (isFull) {
    console.log('Re-importez le plan comptable:  node scripts/import-accounts.js');
  }
  console.log('Vous pouvez maintenant ressaisir clients / fournisseurs / factures.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Erreur reset:', e);
  await prisma.$disconnect();
  process.exit(1);
});
