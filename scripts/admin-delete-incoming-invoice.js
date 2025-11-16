#!/usr/bin/env node
/**
 * Suppression contrôlée d'une facture fournisseur (IncomingInvoice) erronée.
 * Usage: node scripts/admin-delete-incoming-invoice.js <incomingInvoiceId> [--force]
 * Conditions par défaut (sans --force):
 *  - Aucune écriture de trésorerie liée (MoneyMovement)
 *  - Aucune autorisation trésorerie ou bank advice liée
 *  - Aucuns paiements (transactions kind=PAYMENT) enregistrés
 *  - Statut pas PAID / PARTIAL
 * Efface dans l'ordre: transactions, lines, liaisons treasury, facture.
 */
import prisma from '../src/lib/prisma.js';

async function main(){
  const id = process.argv[2];
  const force = process.argv.includes('--force');
  if (!id){
    console.error('ID requis. Usage: node scripts/admin-delete-incoming-invoice.js <id> [--force]');
    process.exit(1);
  }
  const inv = await prisma.incomingInvoice.findUnique({
    where: { id },
    include: {
      lines: true,
      transactions: true,
      moneyMovements: true,
      treasuryAuthorizations: true,
      bankAdvices: true
    }
  });
  if (!inv){
    console.error('Facture fournisseur introuvable');
    process.exit(2);
  }
  const blocking = [];
  if (inv.moneyMovements.length) blocking.push(`moneyMovements=${inv.moneyMovements.length}`);
  if (inv.treasuryAuthorizations.length) blocking.push(`authorizations=${inv.treasuryAuthorizations.length}`);
  if (inv.bankAdvices.length) blocking.push(`bankAdvices=${inv.bankAdvices.length}`);
  const paymentTx = inv.transactions.filter(t => t.kind === 'PAYMENT');
  if (paymentTx.length) blocking.push(`paymentTransactions=${paymentTx.length}`);
  if (['PAID','PARTIAL'].includes(inv.status)) blocking.push(`status=${inv.status}`);

  if (blocking.length && !force){
    console.error('Blocage suppression (utiliser --force si vraiment nécessaire):', blocking.join(', '));
    process.exit(3);
  }

  console.log('Suppression facture fournisseur', inv.entryNumber, '...');
  await prisma.$transaction(async(tx)=>{
    await tx.transaction.deleteMany({ where: { incomingInvoiceId: id } });
    await tx.incomingInvoiceLine.deleteMany({ where: { incomingInvoiceId: id } });
    await tx.incomingInvoice.delete({ where: { id } });
  });
  console.log('OK supprimée.');
}

main().catch(e => { console.error('Erreur suppression', e); process.exit(99); }).finally(async()=>{ await prisma.$disconnect(); });
