import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { finalizeBatchToJournal } from '@/lib/journal';
import { nextSequence } from '@/lib/sequence';
import { getSystemAccounts } from '@/lib/systemAccounts';
import { requireCompanyId } from '@/lib/tenant';

// POST /api/payments
// Body: { date, amount, mode, reference, note, links: [{ invoiceId?, incomingInvoiceId?, amount }] }
export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const { moneyAccountId, date, amount, mode, reference, note, links } = body;
    if (!moneyAccountId || !amount || !mode || !Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }
    const totalVentile = links.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    if (Number(amount) !== totalVentile) {
      return NextResponse.json({ error: 'La somme ventilée ne correspond pas au montant du paiement' }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      // Création du paiement
      const payment = await tx.payment.create({
        data: {
          companyId,
          date: date ? new Date(date) : new Date(),
          amount,
          mode,
          reference,
          note,
        },
      });
      // Récupérer le compte banque/caisse (MoneyAccount)
      const moneyAccount = await tx.moneyAccount.findUnique({
        where: { id: moneyAccountId },
        include: { ledgerAccount: true },
      });
      if (moneyAccount && moneyAccount.companyId !== companyId) {
        throw new Error('Compte banque/caisse hors société');
      }
      if (!moneyAccount || !moneyAccount.ledgerAccountId) throw new Error('Compte banque/caisse introuvable ou non paramétré');
      // Comptes système
      const { vatAccount, vatDeductibleAccount } = await getSystemAccounts();
      // Transactions à journaliser
      const transactions = [];
      // Création des liens PaymentInvoiceLink et MAJ factures
      for (const l of links) {
        await tx.paymentInvoiceLink.create({
          data: {
            companyId,
            paymentId: payment.id,
            invoiceId: l.invoiceId || undefined,
            incomingInvoiceId: l.incomingInvoiceId || undefined,
            amount: l.amount,
          },
        });
        // MAJ statuts et soldes factures
        if (l.invoiceId) {
          const inv = await tx.invoice.findFirst({ where: { id: l.invoiceId, companyId }, include: { client: true } });
          const paid = inv.paidAmount.plus(l.amount);
          const remaining = inv.totalAmount.minus(paid);
          await tx.invoice.update({
            where: { id: l.invoiceId },
            data: {
              paidAmount: paid,
              outstandingAmount: remaining,
              status: remaining.lte(0) ? 'PAID' : 'PARTIAL',
            },
          });
          // Générer transaction : Débit banque, Crédit 411 (client)
          if (!inv.client?.accountId) throw new Error('Compte client non paramétré');
          transactions.push(
            await tx.transaction.create({
              data: {
                companyId,
                date: date ? new Date(date) : new Date(),
                amount: l.amount,
                direction: 'CREDIT',
                accountId: inv.client.accountId,
                description: `Règlement facture client ${inv.invoiceNumber}`,
                kind: 'PAYMENT',
              },
            })
          );
        }
        if (l.incomingInvoiceId) {
          const inv = await tx.incomingInvoice.findFirst({ where: { id: l.incomingInvoiceId, companyId }, include: { supplier: true } });
          const paid = inv.paidAmount.plus(l.amount);
          const remaining = inv.totalAmount.minus(paid);
          await tx.incomingInvoice.update({
            where: { id: l.incomingInvoiceId },
            data: {
              paidAmount: paid,
              outstandingAmount: remaining,
              status: remaining.lte(0) ? 'PAID' : 'PARTIAL',
            },
          });
          // Générer transaction : Débit 401 (fournisseur), Crédit banque
          if (!inv.supplier?.accountId) throw new Error('Compte fournisseur non paramétré');
          transactions.push(
            await tx.transaction.create({
              data: {
                companyId,
                date: date ? new Date(date) : new Date(),
                amount: l.amount,
                direction: 'DEBIT',
                accountId: inv.supplier.accountId,
                description: `Paiement facture fournisseur ${inv.supplierInvoiceNumber}`,
                kind: 'PAYMENT',
              },
            })
          );
        }
      }
      // Transaction banque/caisse (contrepartie globale)
      transactions.push(
        await tx.transaction.create({
          data: {
            companyId,
            date: date ? new Date(date) : new Date(),
            amount,
            direction: 'DEBIT',
            accountId: moneyAccount.ledgerAccountId,
            description: 'Paiement client/fournisseur',
            kind: 'PAYMENT',
          },
        })
      );
      // Finaliser l’écriture au journal
      await finalizeBatchToJournal(tx, {
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        date: date ? new Date(date) : new Date(),
        transactions,
        description: reference || 'Paiement',
      });
      return payment;
    });
    return NextResponse.json({ ok: true, payment: result });
  } catch (e) {
    console.error('POST /api/payments error', e);
    return NextResponse.json({ error: e.message || 'Erreur création paiement', details: e.stack }, { status: 500 });
  }
}
