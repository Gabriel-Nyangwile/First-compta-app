import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCategoryAccounts } from '@/lib/assets';
import { getSystemAccounts } from '@/lib/systemAccounts';
import { checkPerm, getUserRole } from '@/lib/authz';

export const dynamic = 'force-dynamic';

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

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

export async function POST(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  try {
    const role = await getUserRole(req);
    if (!checkPerm('generateAssetInvoice', role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const payload = await req.json().catch(() => ({}));
    const supplierInvoiceNumber = (payload.supplierInvoiceNumber || '').trim();
    if (!supplierInvoiceNumber) return NextResponse.json({ error: 'Numero facture fournisseur requis' }, { status: 400 });
    const receiptDate = parseDate(payload.receiptDate) || new Date();
    const issueDate = parseDate(payload.issueDate) || receiptDate;
    let dueDate = parseDate(payload.dueDate);
    const termDays = Number.isFinite(Number(payload.paymentTermDays)) ? Number(payload.paymentTermDays) : null;
    if (!dueDate) {
      dueDate = termDays != null ? addDays(receiptDate, termDays) : receiptDate;
    }

    const apo = await prisma.assetPurchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { assetCategory: true } } },
    });
    if (!apo) return NextResponse.json({ error: 'BC immob non trouve' }, { status: 404 });
    if (apo.status === 'INVOICED') return NextResponse.json({ error: 'BC deja facture' }, { status: 409 });
    if (apo.status !== 'RECEIVED') return NextResponse.json({ error: 'BC non recu : facture impossible' }, { status: 409 });
    if (!apo.lines.length) return NextResponse.json({ error: 'Aucune ligne' }, { status: 400 });

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
          receiptDate,
          issueDate,
          dueDate,
          totalAmount: (totalHt + totalVat).toFixed(2),
          totalAmountHt: totalHt.toFixed(2),
          vatAmount: totalVat.toFixed(2),
          vat: 0,
          paidAmount: '0',
          outstandingAmount: (totalHt + totalVat).toFixed(2),
          supplierInvoiceNumber,
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
            date: receiptDate,
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
              date: receiptDate,
              nature: 'purchase',
              description: `TVA deductible ${pct}% facture ${inv.entryNumber}`,
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
          date: receiptDate,
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
        date: receiptDate,
        description: `Facture fournisseur immob ${inv.entryNumber}`,
        transactions: txns,
      });

      await tx.assetPurchaseOrder.update({ where: { id: apo.id }, data: { status: 'INVOICED', incomingInvoiceId: inv.id } });
      return inv;
    });

    return NextResponse.json({ ok: true, invoiceId: invoice.id, entryNumber: invoice.entryNumber });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Creation facture immob echouee' }, { status: 500 });
  }
}
