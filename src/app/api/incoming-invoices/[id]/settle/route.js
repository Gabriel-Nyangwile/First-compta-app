import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { finalizeBatchToJournal } from '@/lib/journal';
import { requireCompanyId } from '@/lib/tenant';

/*
  POST /api/incoming-invoices/:id/settle
  Body: { amount, paymentDate?, bankAccountId }
  Règles:
   - amount > 0
   - bankAccountId requis (compte banque 512)
   - Création de deux écritures:
       DEBIT fournisseur (PAYABLE) montant réglé
       CREDIT banque (PAYMENT) montant réglé
   - Si total payé >= total facture => statut PAID
*/
export async function POST(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const incomingInvoiceId = params.id;
    const { amount, paymentDate, bankAccountId } = await request.json();

    if (!incomingInvoiceId) return NextResponse.json({ error: 'Incoming invoice id manquant.' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Montant de paiement invalide.' }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ error: 'Compte banque requis.' }, { status: 400 });

    const invoice = await prisma.incomingInvoice.findFirst({
      where: { id: incomingInvoiceId, companyId },
      include: { supplier: true, transactions: true }
    });
    if (!invoice) return NextResponse.json({ error: 'Facture fournisseur introuvable.' }, { status: 404 });
    if (!invoice.supplier || !invoice.supplier.accountId) return NextResponse.json({ error: 'Compte fournisseur (401) introuvable.' }, { status: 400 });

    const alreadyPaid = invoice.transactions
      .filter(t => t.kind === 'PAYMENT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const remaining = Number(invoice.totalAmount) - alreadyPaid;
    if (Number(amount) > remaining) {
      return NextResponse.json({ error: 'Montant supérieur au solde restant.' }, { status: 400 });
    }

    const paymentDateObj = paymentDate ? new Date(paymentDate) : new Date();

    const result = await prisma.$transaction(async(tx) => {
      // Résolution compte banque: bankAccountId peut être un Account ou un MoneyAccount
      let resolvedAccountId = bankAccountId;
      let moneyAccount = await tx.moneyAccount.findFirst({
        where: { id: bankAccountId, companyId },
        include: { ledgerAccount: true },
      });
      if (moneyAccount && moneyAccount.ledgerAccount) {
        resolvedAccountId = moneyAccount.ledgerAccount.id;
      }
      // Créer un moneyMovement pour traçabilité trésorerie
      const movement = await tx.moneyMovement.create({
        data: {
          companyId,
          date: paymentDateObj,
          amount: String(amount),
          direction: 'OUT',
          kind: 'SUPPLIER_PAYMENT',
          moneyAccount: moneyAccount ? { connect: { id: moneyAccount.id } } : undefined,
          incomingInvoice: { connect: { id: invoice.id } },
          voucherRef: `MV-${Date.now()}`,
          description: `Règlement facture ${invoice.entryNumber}`
        }
      });
      // Crédit banque (sortie) et Débit fournisseur (diminution dette)
      const createdTxs = [];
      const debitPayable = await tx.transaction.create({
        data: {
          companyId,
          date: paymentDateObj,
          nature: 'payment',
          description: `Règlement facture fournisseur ${invoice.entryNumber} (dette)`,
          amount: String(amount),
          direction: 'DEBIT',
          kind: 'PAYABLE',
          account: { connect: { id: invoice.supplier.accountId } },
          incomingInvoice: { connect: { id: invoice.id } },
          supplier: { connect: { id: invoice.supplier.id } },
          moneyMovement: { connect: { id: movement.id } }
        }
      });
      const creditBank = await tx.transaction.create({
        data: {
          companyId,
          date: paymentDateObj,
          nature: 'payment',
          description: `Règlement facture fournisseur ${invoice.entryNumber} (banque)`,
          amount: String(amount),
          direction: 'CREDIT',
          kind: 'PAYMENT',
          account: { connect: { id: resolvedAccountId } },
          incomingInvoice: { connect: { id: invoice.id } },
          supplier: { connect: { id: invoice.supplier.id } },
          moneyMovement: { connect: { id: movement.id } }
        }
  });
  createdTxs.push(debitPayable, creditBank);

      const newPaidTotal = alreadyPaid + Number(amount);
      let updatedInvoice = invoice;
      if (newPaidTotal >= Number(invoice.totalAmount)) {
        updatedInvoice = await tx.incomingInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID' }
        });
      }
      await finalizeBatchToJournal(tx, {
        sourceType: 'INCOMING_INVOICE',
        sourceId: invoice.id,
        date: paymentDateObj,
        description: `Règlement facture fournisseur ${invoice.entryNumber}`,
        transactions: createdTxs
      });

      return { debitPayable, creditBank, invoice: updatedInvoice, paidTotal: newPaidTotal, moneyMovement: movement };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error('Erreur règlement facture fournisseur:', e);
    return NextResponse.json({ error: 'Erreur lors du règlement.' }, { status: 500 });
  }
}
