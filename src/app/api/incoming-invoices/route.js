import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSystemAccounts } from '@/lib/systemAccounts';

// Génère le prochain numéro d'entrée séquentiel EI-YYYY-0001
async function generateNextEntryNumber(tx) {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
  const count = await tx.incomingInvoice.count({
    where: { receiptDate: { gte: startOfYear, lte: endOfYear } }
  });
  const seq = count + 1; // prochain
  const seqPadded = String(seq).padStart(4, '0');
  return `EI-${year}-${seqPadded}`;
}

// GET /api/incoming-invoices  (simple listing with supplier & lines basic aggregation)
export async function GET() {
  const now = new Date();
  // Mettre à jour OVERDUE pour factures fournisseurs non payées échéances dépassées
  await prisma.incomingInvoice.updateMany({
    where: {
      status: { in: ['PENDING','OVERDUE'] },
      dueDate: { lt: now },
      transactions: { none: { kind: 'PAYMENT' } }
    },
    data: { status: 'OVERDUE' }
  });
  const invoices = await prisma.incomingInvoice.findMany({
    orderBy: { receiptDate: 'desc' },
    include: {
      supplier: { select: { id: true, name: true } },
      lines: true,
      transactions: { select: { id: true, kind: true, amount: true } }
    }
  });
  return NextResponse.json({ invoices });
}

/*
 POST /api/incoming-invoices
 Body: {
   supplierId, receiptDate?, issueDate?, dueDate?, vat, supplierInvoiceNumber,
   lines: [ { description, accountId, unitOfMeasure, quantity, unitPrice } ]
 }
*/
export async function POST(req) {
  try {
    const body = await req.json();
  let { supplierId, receiptDate, issueDate, dueDate, vat, supplierInvoiceNumber, lines } = body || {};

    if (!supplierId) return NextResponse.json({ error: 'supplierId requis' }, { status: 400 });
    if (!supplierInvoiceNumber || !String(supplierInvoiceNumber).trim()) return NextResponse.json({ error: 'Numéro facture fournisseur requis' }, { status: 400 });
    if (!Array.isArray(lines) || !lines.length) return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 });

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 });
    if (!supplier.accountId) return NextResponse.json({ error: 'Compte fournisseur (401) manquant sur le fournisseur' }, { status: 400 });

    // Normalisation multi-taux: vat fallback global si lignes sans vatRate
    const fallbackVat = vat !== undefined && vat !== null ? Number(vat) : 0.2;
    if (isNaN(fallbackVat) || fallbackVat < 0) return NextResponse.json({ error: 'Taux TVA invalide' }, { status: 400 });

    let totalHt = 0;
    const buckets = new Map(); // rate -> { base, vat }
    const cleanedLines = lines.map(l => {
      if (!l.accountId) throw new Error('Chaque ligne doit avoir un compte (charge)');
      const qty = Number(l.quantity);
      const up = Number(l.unitPrice);
      if (isNaN(qty) || qty <= 0) throw new Error('Quantité invalide');
      if (isNaN(up) || up < 0) throw new Error('Prix unitaire invalide');
      const lt = qty * up;
      totalHt += lt;
      let lineRate = l.vatRate !== undefined && l.vatRate !== null && l.vatRate !== '' ? Number(l.vatRate) : fallbackVat;
      if (isNaN(lineRate) || lineRate < 0) throw new Error('vatRate ligne invalide');
      const lineVat = lt * lineRate;
      const key = lineRate.toFixed(2);
      const bucket = buckets.get(key) || { base: 0, vat: 0 };
      bucket.base += lt;
      bucket.vat += lineVat;
      buckets.set(key, bucket);
      return {
        description: String(l.description || '').trim() || 'Ligne',
        accountId: l.accountId,
        unitOfMeasure: String(l.unitOfMeasure || 'u'),
        quantity: String(qty),
        unitPrice: String(up),
        lineTotal: String(lt),
        vatRate: lineRate
      };
    });

    let vatAmount = 0; for (const b of buckets.values()) vatAmount += b.vat;
    const totalTtc = totalHt + vatAmount;
    // invoice.vat : si un seul taux sinon 0
    const invoiceVat = buckets.size === 1 ? Number([...buckets.keys()][0]) : 0;

    const { vatDeductibleAccount } = await getSystemAccounts();

  const invoice = await prisma.$transaction(async(tx) => {
      const entryNumber = await generateNextEntryNumber(tx);
      const created = await tx.incomingInvoice.create({
        data: {
          entryNumber,
          supplierInvoiceNumber: String(supplierInvoiceNumber).trim(),
          receiptDate: receiptDate ? new Date(receiptDate) : undefined,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          vat: String(invoiceVat),
          vatAmount: String(vatAmount),
          totalAmountHt: String(totalHt),
          totalAmount: String(totalTtc),
          supplier: { connect: { id: supplierId } }
        }
      });

      // Lignes + transactions PURCHASE liées directement
      for (const l of cleanedLines) {
        const lineRec = await tx.incomingInvoiceLine.create({
          data: { ...l, vatRate: l.vatRate.toFixed(2), incomingInvoiceId: created.id }
        });
        await tx.transaction.create({
          data: {
            date: new Date(),
            nature: 'purchase',
            // Description = article de la ligne
            description: lineRec.description,
            amount: l.lineTotal,
            direction: 'DEBIT',
            kind: 'PURCHASE',
            accountId: l.accountId,
            incomingInvoiceId: created.id,
            incomingInvoiceLineId: lineRec.id,
            supplierId
          }
        });
      }

      // TVA déductible : une écriture par taux distinct
      if (vatDeductibleAccount && buckets.size) {
        for (const [rateStr, bucket] of buckets.entries()) {
          if (bucket.vat <= 0) continue;
          const pct = (Number(rateStr) * 100).toFixed(2).replace(/\.00$/,'');
          await tx.transaction.create({
            data: {
              date: new Date(),
              nature: 'purchase',
              description: `TVA déductible ${pct}% facture ${created.entryNumber}`,
              amount: bucket.vat.toString(),
              direction: 'DEBIT',
              kind: 'VAT_DEDUCTIBLE',
              accountId: vatDeductibleAccount.id,
              incomingInvoiceId: created.id,
              supplierId
            }
          });
        }
      }

      await tx.transaction.create({
        data: {
          date: new Date(),
          nature: 'purchase',
          description: `Dette fournisseur facture ${created.entryNumber}`,
          amount: String(totalTtc),
          direction: 'CREDIT',
          kind: 'PAYABLE',
          accountId: supplier.accountId,
          incomingInvoiceId: created.id,
          supplierId
        }
      });

      return created.id;
    });

    const full = await prisma.incomingInvoice.findUnique({
      where: { id: invoice },
      include: { supplier: true, lines: true, transactions: true }
    });
    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error('POST /api/incoming-invoices error', e);
    return NextResponse.json({ error: e.message || 'Erreur création facture fournisseur' }, { status: 500 });
  }
}
