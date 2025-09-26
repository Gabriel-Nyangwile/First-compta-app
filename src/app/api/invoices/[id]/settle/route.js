import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/*
  POST /api/invoices/:id/settle
  Body: { amount, paymentDate?, bankAccountId }
  Règles:
   - amount > 0
   - bankAccountId requis (compte banque)
   - Création de deux écritures:
       DEBIT bank (PAYMENT) montant réglé
       CREDIT client (RECEIVABLE) montant réglé
   - Si total payé (somme paiements) >= total facture => statut PAID
*/
export async function POST(request, { params }) {
  try {
    const invoiceId = params.id;
    const { amount, paymentDate, bankAccountId } = await request.json();

    if (!invoiceId) return NextResponse.json({ error: 'Invoice id manquant.' }, { status: 400 });
    if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Montant de paiement invalide.' }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ error: 'Compte banque requis.' }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, transactions: true }
    });
    if (!invoice) return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
    if (!invoice.client || !invoice.client.accountId) return NextResponse.json({ error: 'Compte client introuvable pour cette facture.' }, { status: 400 });

    const alreadyPaid = invoice.transactions
      .filter(t => t.kind === 'PAYMENT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const remaining = Number(invoice.totalAmount) - alreadyPaid;
    if (Number(amount) > remaining) {
      return NextResponse.json({ error: 'Montant supérieur au solde restant.' }, { status: 400 });
    }

    const paymentDateObj = paymentDate ? new Date(paymentDate) : new Date();

    const result = await prisma.$transaction(async(tx) => {
      // Création des deux transactions miroir
      const debitBank = await tx.transaction.create({
        data: {
          date: paymentDateObj,
          nature: 'payment',
            description: `Règlement facture ${invoice.invoiceNumber} (banque)`,
          amount: String(amount),
          direction: 'DEBIT',
          kind: 'PAYMENT',
          account: { connect: { id: bankAccountId } },
          invoice: { connect: { id: invoice.id } },
          client: { connect: { id: invoice.client.id } }
        }
      });
      const creditReceivable = await tx.transaction.create({
        data: {
          date: paymentDateObj,
          nature: 'payment',
          description: `Règlement facture ${invoice.invoiceNumber} (créance)`,
          amount: String(amount),
          direction: 'CREDIT',
          kind: 'PAYMENT',
          account: { connect: { id: invoice.client.accountId } },
          invoice: { connect: { id: invoice.id } },
          client: { connect: { id: invoice.client.id } }
        }
      });

      const newPaidTotal = alreadyPaid + Number(amount);
      let updatedInvoice = invoice;
      if (newPaidTotal >= Number(invoice.totalAmount)) {
        updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID' }
        });
      }
      return { debitBank, creditReceivable, invoice: updatedInvoice, paidTotal: newPaidTotal };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error('Erreur règlement facture:', e);
    return NextResponse.json({ error: 'Erreur lors du règlement.' }, { status: 500 });
  }
}
