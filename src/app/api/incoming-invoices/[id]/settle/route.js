import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    const incomingInvoiceId = params.id;
    const { amount, paymentDate, bankAccountId } = await request.json();

    if (!incomingInvoiceId) return NextResponse.json({ error: 'Incoming invoice id manquant.' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Montant de paiement invalide.' }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ error: 'Compte banque requis.' }, { status: 400 });

    const invoice = await prisma.incomingInvoice.findUnique({
      where: { id: incomingInvoiceId },
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
      // Crédit banque (sortie) et Débit fournisseur (diminution dette)
      const debitPayable = await tx.transaction.create({
        data: {
          date: paymentDateObj,
          nature: 'payment',
          description: `Règlement facture fournisseur ${invoice.entryNumber} (dette)`,
          amount: String(amount),
          direction: 'DEBIT',
          kind: 'PAYABLE',
          account: { connect: { id: invoice.supplier.accountId } },
          incomingInvoice: { connect: { id: invoice.id } },
          supplier: { connect: { id: invoice.supplier.id } }
        }
      });
      const creditBank = await tx.transaction.create({
        data: {
          date: paymentDateObj,
          nature: 'payment',
          description: `Règlement facture fournisseur ${invoice.entryNumber} (banque)`,
          amount: String(amount),
          direction: 'CREDIT',
          kind: 'PAYMENT',
          account: { connect: { id: bankAccountId } },
          incomingInvoice: { connect: { id: invoice.id } },
          supplier: { connect: { id: invoice.supplier.id } }
        }
      });

      const newPaidTotal = alreadyPaid + Number(amount);
      let updatedInvoice = invoice;
      if (newPaidTotal >= Number(invoice.totalAmount)) {
        updatedInvoice = await tx.incomingInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID' }
        });
      }

      return { debitPayable, creditBank, invoice: updatedInvoice, paidTotal: newPaidTotal };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error('Erreur règlement facture fournisseur:', e);
    return NextResponse.json({ error: 'Erreur lors du règlement.' }, { status: 500 });
  }
}
