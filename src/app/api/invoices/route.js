
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyOutMovement } from '@/lib/inventory';
import { getSystemAccounts } from '@/lib/systemAccounts';

// GET /api/invoices
export async function GET(request) {
  // Mettre à jour à la volée les statuts OVERDUE (lazy update)
  const now = new Date();
  await prisma.invoice.updateMany({
    where: {
      status: { in: ['PENDING','OVERDUE'] },
      dueDate: { lt: now },
      transactions: { none: { kind: 'PAYMENT' } }
    },
    data: { status: 'OVERDUE' }
  });
  const invoices = await prisma.invoice.findMany({
    include: { 
      client: true,
      moneyMovements: { select: { id: true, date: true, amount: true, voucherRef: true, direction: true }, orderBy: { date: 'asc' } }
    },
    orderBy: { issueDate: 'desc' }
  });
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  return new Response(JSON.stringify({ invoices, clients }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// POST /api/invoices
export async function POST(request) {
  try {
    const data = await request.json();
    const {
      clientId,
      issueDate,
      dueDate,
      vat, // taux global fallback (legacy)
      invoiceLines,
      userId,
      status,
      invoiceNumber
    } = data;

    if (!Array.isArray(invoiceLines) || !invoiceLines.length) {
      return NextResponse.json({ error: 'invoiceLines requis' }, { status: 400 });
    }

    // Préparation / calcul totaux multi-taux potentiel
    let totalAmountHt = 0;
    const vatBuckets = new Map(); // key: rate string, value: { base, vat }
    const normalizedLines = invoiceLines.map((line, idx) => {
      if (!line.accountId) throw new Error('Chaque ligne doit avoir un compte.');
      const quantityNum = Number(line.quantity);
      const unitPriceNum = Number(line.unitPrice);
      if (isNaN(quantityNum) || isNaN(unitPriceNum)) throw new Error('Quantité ou prix invalide.');
      const lineTotalNum = quantityNum * unitPriceNum;
      totalAmountHt += lineTotalNum;

      // vatRate par ligne (prioritaire) sinon fallback global
      let lineVatRate = line.vatRate !== undefined && line.vatRate !== null && line.vatRate !== '' ? Number(line.vatRate) : undefined;
      if (lineVatRate !== undefined && (isNaN(lineVatRate) || lineVatRate < 0)) {
        throw new Error('vatRate ligne invalide');
      }
      if (lineVatRate === undefined) {
        // fallback global si fourni
        const fallback = Number(vat);
        if (!isNaN(fallback) && fallback >= 0) lineVatRate = fallback; else lineVatRate = 0;
      }
      const lineVatAmount = lineTotalNum * lineVatRate;
      const bucketKey = lineVatRate.toFixed(2);
      const bucket = vatBuckets.get(bucketKey) || { base: 0, vat: 0 };
      bucket.base += lineTotalNum;
      bucket.vat += lineVatAmount;
      vatBuckets.set(bucketKey, bucket);

      return {
        index: idx,
        description: String(line.description || '').trim() || 'Article',
        accountId: line.accountId,
        unitOfMeasure: String(line.unitOfMeasure || ''),
        quantity: String(quantityNum),
        unitPrice: String(unitPriceNum),
        lineTotal: String(lineTotalNum),
        vatRate: lineVatRate, // stocké numériquement (sera converti en Decimal string)
        productId: line.productId || null
      };
    });
    // Agrégation VAT
    let vatAmount = 0;
    for (const { vat } of vatBuckets.values()) vatAmount += vat;
    const totalAmount = totalAmountHt + vatAmount;

    // Choix du champ invoice.vat : on garde la valeur globale si homogène sinon 0 (ou premier) -> ici on choisit si un seul bucket => ce taux, sinon 0
    let invoiceLevelVat = 0;
    if (vatBuckets.size === 1) {
      invoiceLevelVat = Number([...vatBuckets.keys()][0]);
    }

    const { vatAccount } = await getSystemAccounts();
    const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
    const clientAccountId = client?.accountId || null;

    const createdInvoice = await prisma.$transaction(async (tx) => {
      // Créer la facture sans lignes/écritures dans un premier temps
      const inv = await tx.invoice.create({
        data: {
          clientId,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          vat: invoiceLevelVat, // valeur indicative (legacy)
          totalAmountHt,
          vatAmount,
          totalAmount,
          userId,
          status,
          invoiceNumber: invoiceNumber ? String(invoiceNumber) : `INV-${Date.now()}`
        }
      });

      // Créer lignes + transactions SALE immédiatement pour lier invoiceLineId sans heuristique
      for (const l of normalizedLines) {
        const lineRecord = await tx.invoiceLine.create({
          data: {
            description: l.description,
            accountId: l.accountId,
            unitOfMeasure: l.unitOfMeasure,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            vatRate: l.vatRate !== undefined ? l.vatRate.toFixed(2) : undefined,
            invoiceId: inv.id,
            productId: l.productId || undefined
          }
        });
        await tx.transaction.create({
          data: {
            nature: 'receipt',
            // Description = description de la ligne (article)
            description: lineRecord.description,
            amount: l.lineTotal,
            direction: 'CREDIT',
            kind: 'SALE',
            accountId: l.accountId,
            clientId: clientId || undefined,
            invoiceId: inv.id,
            invoiceLineId: lineRecord.id
          }
        });
        // Si la ligne référence un produit stocké → création d'un mouvement de stock OUT (phase 2)
        if (l.productId) {
          try {
            const out = await applyOutMovement(tx, { productId: l.productId, qty: Number(l.quantity) });
            await tx.stockMovement.create({
              data: {
                productId: l.productId,
                movementType: 'OUT',
                quantity: l.quantity,
                unitCost: out.unitCost.toFixed(4),
                totalCost: out.totalCost.toFixed(2),
                invoiceLineId: lineRecord.id
              }
            });
          } catch (e) {
            // Stock insuffisant: on peut soit échouer soit autoriser coût null. Ici on échoue.
            throw new Error(`Stock insuffisant pour le produit lié à la ligne ${l.index+1}.`);
          }
        }
      }

      // Créance client (411) TTC
      if (clientAccountId) {
        await tx.transaction.create({
          data: {
            nature: 'receipt',
            description: `Créance facture ${inv.invoiceNumber}`,
            amount: String(totalAmount),
            direction: 'DEBIT',
            kind: 'RECEIVABLE',
            accountId: clientAccountId,
            clientId: clientId || undefined,
            invoiceId: inv.id
          }
        });
      }

      // TVA collectée : une écriture par taux distinct pour traçabilité multi-taux
      if (vatAccount && vatBuckets.size) {
        for (const [rateStr, bucket] of vatBuckets.entries()) {
          if (bucket.vat <= 0) continue;
          const pct = (Number(rateStr) * 100).toFixed(2).replace(/\.00$/,'');
          await tx.transaction.create({
            data: {
              nature: 'receipt',
              description: `TVA ${pct}% facture ${inv.invoiceNumber}`,
              amount: bucket.vat.toString(),
              direction: 'CREDIT',
              kind: 'VAT_COLLECTED',
              accountId: vatAccount.id,
              clientId: clientId || undefined,
              invoiceId: inv.id
            }
          });
        }
      }

      return inv.id;
    });

    // Retour facture complète avec lignes & transactions déjà liées proprement
    const full = await prisma.invoice.findUnique({
      where: { id: createdInvoice },
      include: { invoiceLines: true, client: true, transactions: true }
    });
    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    console.error('Erreur création facture:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de la création de la facture.' }, { status: 500 });
  }
}
