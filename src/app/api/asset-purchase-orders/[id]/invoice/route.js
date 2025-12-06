import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCategoryAccounts } from '@/lib/assets';
import { getSystemAccounts } from '@/lib/systemAccounts';

export const dynamic = 'force-dynamic';

async function generateNextEntryNumber(tx) {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
  const count = await tx.incomingInvoice.count({
    where: { receiptDate: { gte: startOfYear, lte: endOfYear } },
  });
  const seq = count + 1;
  const seqPadded = String(seq).padStart(4, '0');
  return `EI-${year}-${seqPadded}`;
}

export async function POST(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  try {
    const apo = await prisma.assetPurchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { assetCategory: true } } },
    });
    if (!apo) return NextResponse.json({ error: 'BC immob non trouvé' }, { status: 404 });
    if (apo.status !== 'RECEIVED' && apo.status !== 'APPROVED') {
      // allow from APPROVED for simplification
    }
    if (!apo.lines.length) return NextResponse.json({ error: 'Aucune ligne' }, { status: 400 });

    const today = new Date();
    const lines = [];
    let totalHt = 0;
    let totalVat = 0;
    const vatBuckets = new Map(); // rate -> vat amount
    for (const l of apo.lines) {
      const qty = Number(l.quantity?.toNumber?.() ?? l.quantity ?? 1);
      const pu = Number(l.unitPrice?.toNumber?.() ?? l.unitPrice ?? 0);
      const rate = l.vatRate != null ? Number(l.vatRate) : null;
      const ht = qty * pu;
      const vatAmt = rate != null ? ht * rate : 0;
      totalHt += ht;
      totalVat += vatAmt;
      if (rate != null) vatBuckets.set(rate, (vatBuckets.get(rate) || 0) + vatAmt);
      const accounts = await resolveCategoryAccounts(l.assetCategory);
      lines.push({
        description: l.label || 'Immobilisation',
        unitOfMeasure: 'UN',
        quantity: qty.toString(),
        unitPrice: pu.toString(),
        lineTotal: ht.toString(),
        vatRate: rate != null ? rate : undefined,
        accountId: accounts.asset,
        purchaseOrderLineId: null,
        productId: null,
      });
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const entryNumber = await generateNextEntryNumber(tx);
      // Resolve supplier account (fallback 401000)
      let supplierAccountId = apo.supplier?.accountId || null;
      if (!supplierAccountId) {
        let acc = await tx.account.findFirst({ where: { number: '401000' } });
        if (!acc) acc = await tx.account.create({ data: { number: '401000', label: 'Fournisseurs' } });
        supplierAccountId = acc.id;
      }
      const { vatDeductibleAccount } = await getSystemAccounts();
      const inv = await tx.incomingInvoice.create({
        data: {
          entryNumber,
          receiptDate: today,
          issueDate: today,
          dueDate: today,
          totalAmount: (totalHt + totalVat).toFixed(2),
          totalAmountHt: totalHt.toFixed(2),
          vatAmount: totalVat.toFixed(2),
          vat: 0,
          paidAmount: '0',
          outstandingAmount: (totalHt + totalVat).toFixed(2),
          supplierInvoiceNumber: apo.number ? `AUTO-${apo.number}` : entryNumber,
          status: 'PENDING',
          supplier: apo.supplierId ? { connect: { id: apo.supplierId } } : undefined,
          lines: { create: lines },
        },
        include: { lines: true },
      });

      const txns = [];
      for (const l of lines) {
        txns.push(await tx.transaction.create({
          data: {
            date: today,
            nature: 'purchase',
            description: l.description,
            amount: l.lineTotal,
            direction: 'DEBIT',
            kind: 'ASSET_ACQUISITION',
            accountId: l.accountId,
            incomingInvoiceId: inv.id,
            supplierId: apo.supplierId || undefined,
          },
        }));
      }
      if (vatDeductibleAccount && vatBuckets.size) {
        for (const [rate, amt] of vatBuckets.entries()) {
          if (!(amt > 0)) continue;
          const pct = (Number(rate) * 100).toFixed(2).replace(/\.00$/, '');
          txns.push(await tx.transaction.create({
            data: {
              date: today,
              nature: 'purchase',
              description: `TVA déductible ${pct}% facture ${inv.entryNumber}`,
              amount: amt.toFixed(2),
              direction: 'DEBIT',
              kind: 'VAT_DEDUCTIBLE',
              accountId: vatDeductibleAccount.id,
              incomingInvoiceId: inv.id,
              supplierId: apo.supplierId || undefined,
            },
          }));
        }
      }
      txns.push(await tx.transaction.create({
        data: {
          date: today,
          nature: 'purchase',
          description: `Dette fournisseur facture ${inv.entryNumber}`,
          amount: (totalHt + totalVat).toFixed(2),
          direction: 'CREDIT',
          kind: 'PAYABLE',
          accountId: supplierAccountId,
          incomingInvoiceId: inv.id,
          supplierId: apo.supplierId || undefined,
        },
      }));

      const { finalizeBatchToJournal } = await import('@/lib/journal');
      await finalizeBatchToJournal(tx, {
        sourceType: 'INCOMING_INVOICE',
        sourceId: inv.id,
        date: today,
        description: `Facture fournisseur immob ${inv.entryNumber}`,
        transactions: txns,
      });

      await tx.assetPurchaseOrder.update({ where: { id: apo.id }, data: { status: 'INVOICED' } });
      return inv;
    });

    return NextResponse.json({ ok: true, invoiceId: invoice.id, entryNumber: invoice.entryNumber });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Création facture immob échouée' }, { status: 500 });
  }
}

