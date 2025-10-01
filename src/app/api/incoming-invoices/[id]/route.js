import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSystemAccounts } from '@/lib/systemAccounts';

// GET /api/incoming-invoices/:id
// Note: In newer Next.js versions, params may be async – await context.params
export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const invoice = await prisma.incomingInvoice.findUnique({
      where: { id },
      include: {
        lines: { include: { account: { select: { id: true, number: true, label: true } } } },
        supplier: { include: { account: true } },
        transactions: true,
        purchaseOrder: { select: { id: true, number: true } }
      }
    });
    if (!invoice) return NextResponse.json({ error: 'Facture fournisseur introuvable' }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (e) {
    console.error('GET incoming invoice error', e);
    return NextResponse.json({ error: 'Erreur récupération facture fournisseur' }, { status: 500 });
  }
}

// PATCH /api/incoming-invoices/:id
// Body: { supplierId?, receiptDate?, issueDate?, dueDate?, vat?, lines: [ { description, accountId, unitOfMeasure, quantity, unitPrice } ] }
export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { supplierId, receiptDate, issueDate, dueDate, vat, lines } = body || {};

    const existing = await prisma.incomingInvoice.findUnique({
      where: { id },
      include: { transactions: true, lines: true, supplier: true }
    });
    if (!existing) return NextResponse.json({ error: 'Facture fournisseur introuvable' }, { status: 404 });
    if (existing.status === 'PAID') return NextResponse.json({ error: 'Facture déjà payée, modification interdite.' }, { status: 400 });
    const hasPayment = existing.transactions.some(t => t.kind === 'PAYMENT');
    if (hasPayment) return NextResponse.json({ error: 'Paiements enregistrés : modification interdite.' }, { status: 400 });

    if (!Array.isArray(lines) || !lines.length) return NextResponse.json({ error: 'lines requis' }, { status: 400 });

    let totalHt = 0;
    const normLines = lines.map(l => {
      if (!l.accountId) throw new Error('Chaque ligne doit avoir accountId');
      const quantity = Number(l.quantity);
      const unitPrice = Number(l.unitPrice);
      if (isNaN(quantity) || isNaN(unitPrice)) throw new Error('Quantité / prix invalide');
      const lineTotal = quantity * unitPrice;
      totalHt += lineTotal;
      return {
        description: String(l.description || '').trim() || 'Ligne',
        accountId: l.accountId,
        unitOfMeasure: String(l.unitOfMeasure || ''),
        quantity: String(quantity),
        unitPrice: String(unitPrice),
        lineTotal: String(lineTotal)
      };
    });
    const vatRate = vat !== undefined && vat !== null ? Number(vat) : Number(existing.vat);
    if (isNaN(vatRate) || vatRate < 0) return NextResponse.json({ error: 'Taux TVA invalide' }, { status: 400 });
    const vatAmount = totalHt * vatRate;
    const totalTtc = totalHt + vatAmount;

    const { vatDeductibleAccount } = await getSystemAccounts();
    const supplier = supplierId ? await prisma.supplier.findUnique({ where: { id: supplierId } }) : existing.supplier;
    if (!supplier || !supplier.accountId) return NextResponse.json({ error: 'Fournisseur ou compte fournisseur invalide' }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { incomingInvoiceId: id } });
      await tx.incomingInvoiceLine.deleteMany({ where: { incomingInvoiceId: id } });

      const inv = await tx.incomingInvoice.update({
        where: { id },
        data: {
          supplierId: supplierId || existing.supplierId,
          receiptDate: receiptDate ? new Date(receiptDate) : existing.receiptDate,
          issueDate: issueDate ? new Date(issueDate) : existing.issueDate,
          dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
          vat: vatRate,
          vatAmount: vatAmount,
          totalAmountHt: totalHt,
          totalAmount: totalTtc
        }
      });

      // Recréer lignes + transactions PURCHASE liées immédiatement
      for (const l of normLines) {
        const lineRec = await tx.incomingInvoiceLine.create({ data: { ...l, incomingInvoiceId: id } });
        await tx.transaction.create({
          data: {
            date: new Date(),
            nature: 'purchase',
            description: lineRec.description, // article
            amount: l.lineTotal,
            direction: 'DEBIT',
            kind: 'PURCHASE',
            accountId: l.accountId,
            incomingInvoiceId: id,
            incomingInvoiceLineId: lineRec.id,
            supplierId: supplier.id
          }
        });
      }
      if (vatAmount > 0 && vatDeductibleAccount) {
        await tx.transaction.create({
          data: {
            date: new Date(),
            nature: 'purchase',
            description: `TVA déductible facture ${inv.entryNumber}`,
            amount: String(vatAmount),
            direction: 'DEBIT',
            kind: 'VAT_DEDUCTIBLE',
            accountId: vatDeductibleAccount.id,
            incomingInvoiceId: id,
            supplierId: supplier.id
          }
        });
      }
      await tx.transaction.create({
        data: {
          date: new Date(),
          nature: 'purchase',
          description: `Dette fournisseur facture ${inv.entryNumber}`,
          amount: String(totalTtc),
          direction: 'CREDIT',
          kind: 'PAYABLE',
          accountId: supplier.accountId,
          incomingInvoiceId: id,
          supplierId: supplier.id
        }
      });
      return inv;
    });
    const full = await prisma.incomingInvoice.findUnique({
      where: { id },
      include: {
        lines: { include: { account: { select: { id: true, number: true, label: true } } } },
        supplier: true,
        transactions: true
      }
    });
    return NextResponse.json(full, { status: 200 });
  } catch (e) {
    console.error('PATCH incoming invoice error', e);
    return NextResponse.json({ error: e.message || 'Erreur mise à jour facture fournisseur' }, { status: 500 });
  }
}
