import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSystemAccounts } from '@/lib/systemAccounts';

// GET /api/invoices/:id
// Await context.params to satisfy Next.js dynamic route requirements
export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        invoiceLines: { include: { account: { select: { id: true, number: true, label: true } } } },
        client: { include: { account: true } },
        transactions: true
      }
    });
    if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (e) {
    console.error('GET invoice error', e);
    return NextResponse.json({ error: 'Erreur récupération facture' }, { status: 500 });
  }
}

// PATCH /api/invoices/:id
// Body: { clientId?, issueDate?, dueDate?, vat?, invoiceLines: [ { id?, description, accountId, unitOfMeasure, quantity, unitPrice } ] }
export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { clientId, issueDate, dueDate, vat, invoiceLines } = body || {};

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { transactions: true, invoiceLines: true }
    });
    if (!existing) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
    if (existing.status === 'PAID') return NextResponse.json({ error: 'Facture déjà payée, modification interdite.' }, { status: 400 });
    const hasPayment = existing.transactions.some(t => t.kind === 'PAYMENT');
    if (hasPayment) return NextResponse.json({ error: 'Paiements enregistrés : modification interdite.' }, { status: 400 });

    if (!Array.isArray(invoiceLines) || !invoiceLines.length) {
      return NextResponse.json({ error: 'invoiceLines requis' }, { status: 400 });
    }

    // Normaliser lignes et recalculer totaux
    let totalHt = 0;
    const normLines = invoiceLines.map(l => {
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

    // Recréer transactions (supprimer anciennes liées à la facture)
    const { vatAccount } = await getSystemAccounts();
    // IMPORTANT: si clientId non fourni on doit récupérer le client existant pour conserver la créance (411)
    let client = null;
    if (clientId) {
      client = await prisma.client.findUnique({ where: { id: clientId } });
    } else if (existing.clientId) {
      client = await prisma.client.findUnique({ where: { id: existing.clientId } });
    }
    const clientAccountId = client?.accountId || null;

    const updated = await prisma.$transaction(async (tx) => {
      // Delete old lines & transactions
      await tx.transaction.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

      // Update invoice scalar fields
      const inv = await tx.invoice.update({
        where: { id },
        data: {
          clientId: clientId || existing.clientId,
          issueDate: issueDate ? new Date(issueDate) : existing.issueDate,
            dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
          vat: vatRate,
          vatAmount: vatAmount,
          totalAmountHt: totalHt,
          totalAmount: totalTtc
        }
      });

      // Recréer lignes et transactions SALE directement liées sans heuristique
      for (const l of normLines) {
        const lineRec = await tx.invoiceLine.create({ data: { ...l, invoiceId: id } });
        await tx.transaction.create({
          data: {
            nature: 'receipt',
            description: lineRec.description, // description article
            amount: l.lineTotal,
            direction: 'CREDIT',
            kind: 'SALE',
            accountId: l.accountId,
            clientId: client?.id || existing.clientId,
            invoiceId: id,
            invoiceLineId: lineRec.id
          }
        });
      }
      // Créance client
      if (clientAccountId) {
        await tx.transaction.create({
          data: {
            nature: 'receipt',
            description: `Créance facture ${inv.invoiceNumber}`,
            amount: String(totalTtc),
            direction: 'DEBIT',
            kind: 'RECEIVABLE',
            accountId: clientAccountId,
            clientId: client?.id || existing.clientId,
            invoiceId: id
          }
        });
      }
      // TVA collectée
      if (vatAmount > 0 && vatAccount) {
        await tx.transaction.create({
          data: {
            nature: 'receipt',
            description: `TVA facture ${inv.invoiceNumber}`,
            amount: String(vatAmount),
            direction: 'CREDIT',
            kind: 'VAT_COLLECTED',
            accountId: vatAccount.id,
            clientId: client?.id || existing.clientId,
            invoiceId: id
          }
        });
      }
      return inv;
    });
    const full = await prisma.invoice.findUnique({
      where: { id },
      include: {
        invoiceLines: { include: { account: { select: { id: true, number: true, label: true } } } },
        client: true,
        transactions: true
      }
    });
    return NextResponse.json(full, { status: 200 });
  } catch (e) {
    console.error('PATCH invoice error', e);
    return NextResponse.json({ error: e.message || 'Erreur mise à jour facture' }, { status: 500 });
  }
}
