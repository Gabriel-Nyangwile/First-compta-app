// scripts/test-payment-flow.js
import prisma from '../src/lib/prisma.js';
import assert from 'assert';

async function main() {
    // Initialiser tous les IDs de test en tout début de fonction
    const testInvoiceIds = (await prisma.invoice.findMany({ where: { invoiceNumber: { contains: 'INV-TST' } }, select: { id: true } })).map(i => i.id);
    const testIncomingInvoiceIds = (await prisma.incomingInvoice.findMany({ where: { entryNumber: { contains: 'INVTST' } }, select: { id: true } })).map(i => i.id);
    const testClientIds = (await prisma.client.findMany({ where: { name: { contains: 'Test' } }, select: { id: true } })).map(c => c.id);
    const testSupplierIds = (await prisma.supplier.findMany({ where: { name: { contains: 'Test' } }, select: { id: true } })).map(s => s.id);
    const testAccountIds = (await prisma.account.findMany({ where: { label: { contains: 'Test' } }, select: { id: true } })).map(a => a.id);
    const testMoneyAccountIds = (await prisma.moneyAccount.findMany({ where: { label: { contains: 'Test' } }, select: { id: true } })).map(m => m.id);
  // Suppression explicite de toutes les entités liées aux clients de test avant suppression des clients
  if (testClientIds.length > 0) {
    await prisma.invoiceLine.deleteMany({ where: { invoice: { clientId: { in: testClientIds } } } });
    await prisma.paymentInvoiceLink.deleteMany({ where: { invoice: { clientId: { in: testClientIds } } } });
    await prisma.transaction.deleteMany({ where: { clientId: { in: testClientIds } } });
    await prisma.invoice.deleteMany({ where: { clientId: { in: testClientIds } } });
    await prisma.salesOrder.deleteMany({ where: { clientId: { in: testClientIds } } });
  }
  // --- Nettoyage complet des entités de test et de leurs enfants ---
  // 1. Récupérer les IDs des factures et factures fournisseurs de test (déjà initialisés en haut)
  // 2. Supprimer les enfants liés aux factures de test
  if (testInvoiceIds.length > 0) {
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: testInvoiceIds } } });
    await prisma.paymentInvoiceLink.deleteMany({ where: { invoiceId: { in: testInvoiceIds } } });
    await prisma.transaction.deleteMany({ where: { invoiceId: { in: testInvoiceIds } } });
    await prisma.bankAdvice.deleteMany({ where: { invoiceId: { in: testInvoiceIds } } });
    await prisma.moneyMovement.deleteMany({ where: { invoiceId: { in: testInvoiceIds } } });
  }
  if (testIncomingInvoiceIds.length > 0) {
    await prisma.incomingInvoiceLine.deleteMany({ where: { incomingInvoiceId: { in: testIncomingInvoiceIds } } });
    await prisma.paymentInvoiceLink.deleteMany({ where: { incomingInvoiceId: { in: testIncomingInvoiceIds } } });
    await prisma.transaction.deleteMany({ where: { incomingInvoiceId: { in: testIncomingInvoiceIds } } });
    await prisma.moneyMovement.deleteMany({ where: { incomingInvoiceId: { in: testIncomingInvoiceIds } } });
    await prisma.bankAdvice.deleteMany({ where: { incomingInvoiceId: { in: testIncomingInvoiceIds } } });
  }
  // 3. Supprimer les factures de test
  if (testInvoiceIds.length > 0) await prisma.invoice.deleteMany({ where: { id: { in: testInvoiceIds } } });
  if (testIncomingInvoiceIds.length > 0) await prisma.incomingInvoice.deleteMany({ where: { id: { in: testIncomingInvoiceIds } } });
  // 4. Récupérer les IDs des clients et fournisseurs de test (déjà initialisés en haut)
  // 5. Supprimer toutes les entités liées à ces clients/fournisseurs
  if (testClientIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { clientId: { in: testClientIds } } });
    await prisma.salesOrder.deleteMany({ where: { clientId: { in: testClientIds } } });
  }
  if (testSupplierIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { supplierId: { in: testSupplierIds } } });
    await prisma.moneyMovement.deleteMany({ where: { supplierId: { in: testSupplierIds } } });
    // Pas de suppression de SalesOrder par supplierId (champ inexistant)
  }
  // 6. Supprimer d'abord les transactions liées aux comptes et moneyAccounts de test (déjà initialisés en haut)
  if (testAccountIds.length > 0) {
    await prisma.transaction.deleteMany({ where: { accountId: { in: testAccountIds } } });
  }
  // 6b. testMoneyAccountIds déjà initialisés en haut
  if (testMoneyAccountIds.length > 0) {
    await prisma.moneyMovement.deleteMany({ where: { moneyAccountId: { in: testMoneyAccountIds } } });
  }
  // 7. Supprimer les paiements, liens, moneyAccounts, comptes, clients, fournisseurs de test
  await prisma.payment.deleteMany({ where: { note: { contains: 'Test' } } });
  await prisma.paymentInvoiceLink.deleteMany();
  await prisma.moneyAccount.deleteMany({ where: { label: { contains: 'Test' } } });
  await prisma.account.deleteMany({ where: { label: { contains: 'Test' } } });
  await prisma.client.deleteMany({ where: { name: { contains: 'Test' } } });
  await prisma.supplier.deleteMany({ where: { name: { contains: 'Test' } } });
  console.log('--- Test flux paiement multi-factures ---');
  // Préparation : créer un client, une facture client, un fournisseur, une facture fournisseur, un compte banque
  const unique = `${Date.now()}${Math.floor(Math.random()*10000)}`;
  const client = await prisma.client.create({ data: { name: 'Test Client', email: `test${unique}@ex.com` } });
  const supplier = await prisma.supplier.create({ data: { name: 'Test Supplier' } });
  // Créer comptes comptables OHADA avec numéro unique
  const bankAccount = await prisma.account.create({ data: { number: `521${unique}`.slice(0,10), label: 'Banque Test OHADA' } });
  const bank = await prisma.moneyAccount.create({ data: { type: 'BANK', label: 'Test Banque', ledgerAccountId: bankAccount.id } });
  const clientAccount = await prisma.account.create({ data: { number: `411${unique}`.slice(0,10), label: 'Client Test OHADA' } });
  const supplierAccount = await prisma.account.create({ data: { number: `401${unique}`.slice(0,10), label: 'Fournisseur Test OHADA' } });
  await prisma.client.update({ where: { id: client.id }, data: { accountId: clientAccount.id } });
  await prisma.supplier.update({ where: { id: supplier.id }, data: { accountId: supplierAccount.id } });
  // Créer factures
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  const invoice = await prisma.invoice.create({ data: { invoiceNumber: `INV-TST-${Date.now()}`, clientId: client.id, totalAmount: 100, paidAmount: 0, outstandingAmount: 100, dueDate } });
  const incomingInvoice = await prisma.incomingInvoice.create({ data: { entryNumber: `INVTST-${Date.now()}`, supplierId: supplier.id, totalAmount: 50, paidAmount: 0, outstandingAmount: 50, supplierInvoiceNumber: 'F123' } });
  // Appel API paiement (POST /api/payments)
  const res = await fetch('http://localhost:3000/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moneyAccountId: bank.id,
      amount: 150,
      mode: 'VIREMENT',
      links: [
        { invoiceId: invoice.id, amount: 100 },
        { incomingInvoiceId: incomingInvoice.id, amount: 50 }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('API /api/payments error: ' + err);
  }
  // Vérifications
  // Vérifications
  const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  const updatedIncoming = await prisma.incomingInvoice.findUnique({ where: { id: incomingInvoice.id } });
  assert(updatedInvoice.status === 'PAID', 'Facture client non soldée');
  assert(updatedIncoming.status === 'PAID', 'Facture fournisseur non soldée');
  console.log('✔️  Paiement multi-factures : statuts OK');
  // Vérifier écritures (journal)
  // ...
  console.log('✔️  Test flux paiement terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
