import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { nextSequence } from '@/lib/sequence';
import { applyInMovement } from '@/lib/inventory';
import { audit } from '@/lib/audit';

// GET /api/goods-receipts?status=&supplierId=&purchaseOrderId=&q=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const supplierId = searchParams.get('supplierId');
  const purchaseOrderId = searchParams.get('purchaseOrderId');
  const q = searchParams.get('q');
  const where = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
  if (q) where.number = { contains: q, mode: 'insensitive' };
  try {
    const receipts = await prisma.goodsReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        purchaseOrder: true,
        lines: { include: { product: true, purchaseOrderLine: true } }
      }
    });
    return NextResponse.json(receipts);
  } catch (e) {
    console.error('GET /goods-receipts error', e);
    return NextResponse.json({ error: 'Erreur récupération réceptions.' }, { status: 500 });
  }
}

// POST /api/goods-receipts
// { supplierId?, purchaseOrderId?, lines:[{ productId, qtyReceived, unitCost, purchaseOrderLineId? }] }
export async function POST(request) {
  try {
    const body = await request.json();
    const { supplierId, purchaseOrderId, lines } = body;
    if ((!supplierId && !purchaseOrderId)) {
      return NextResponse.json({ error: 'supplierId requis si aucun purchaseOrderId.' }, { status: 400 });
    }
    if (!Array.isArray(lines) || !lines.length) return NextResponse.json({ error: 'lines requises.' }, { status: 400 });

    const normLines = lines.map((l, idx) => {
      const productId = l.productId;
      const qty = Number(l.qtyReceived);
      const unitCost = Number(l.unitCost);
      if (!productId || isNaN(qty) || qty <= 0 || isNaN(unitCost) || unitCost < 0) {
        throw new Error(`Ligne ${idx+1} invalide.`);
      }
      return {
        rawPurchaseOrderLineId: l.purchaseOrderLineId || null,
        data: {
          productId,
          qtyReceived: qty.toString(),
          unitCost: unitCost.toString(),
          purchaseOrderLineId: l.purchaseOrderLineId || undefined
        },
        qty,
        unitCost,
        expectedVersion: l.version != null ? Number(l.version) : null
      };
    });

    const tolerancePct = process.env.PO_OVER_RECEIPT_TOLERANCE_PCT ? Number(process.env.PO_OVER_RECEIPT_TOLERANCE_PCT) : 0;
    if (isNaN(tolerancePct) || tolerancePct < 0) {
      console.warn('PO_OVER_RECEIPT_TOLERANCE_PCT invalide, fallback 0');
    }

    const receiptId = await prisma.$transaction(async (tx) => {
      // Validate purchase order if provided
      let po = null;
      if (purchaseOrderId) {
        po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { lines: true } });
        if (!po) throw new Error('PurchaseOrder introuvable.');
      }
      const effectiveSupplierId = supplierId || po?.supplierId || undefined;

      // Over-receipt validation
      for (const l of normLines) {
        if (l.rawPurchaseOrderLineId) {
          const pol = po?.lines.find(pl => pl.id === l.rawPurchaseOrderLineId);
          if (!pol) throw new Error('purchaseOrderLineId invalide.');
          const ordered = Number(pol.orderedQty);
          const newReceived = Number(pol.receivedQty) + l.qty;
          const allowed = ordered * (1 + (tolerancePct/100));
          if (newReceived - allowed > 1e-9) {
            throw new Error(`Réception excédant la quantité commandée (tolérance ${tolerancePct}%).`);
          }
          if (l.expectedVersion != null && pol.version !== l.expectedVersion) {
            const concurrencyInfo = `version attendue ${l.expectedVersion}, actuelle ${pol.version}`;
            const err = new Error('Conflit de version réception. ' + concurrencyInfo);
            err.code = 'CONFLICT_VERSION';
            throw err;
          }
        }
      }

      const number = await nextSequence(tx, 'GR', 'GR-');
      const gr = await tx.goodsReceipt.create({
        data: {
          number,
            supplierId: effectiveSupplierId,
            purchaseOrderId: purchaseOrderId || undefined,
          lines: { create: normLines.map(n => n.data) }
        },
        include: { lines: true }
      });

      // Create stock movements for each line & update inventory (CUMP)
      for (const line of gr.lines) {
        const qtyNum = Number(line.qtyReceived);
        const unitCostNum = Number(line.unitCost);
        await applyInMovement(tx, { productId: line.productId, qty: qtyNum, unitCost: unitCostNum });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            movementType: 'IN',
            quantity: line.qtyReceived,
            unitCost: unitCostNum.toFixed(4),
            totalCost: (qtyNum * unitCostNum).toFixed(2),
            goodsReceiptLineId: line.id
          }
        });
        if (line.purchaseOrderLineId) {
          const normOriginal = normLines.find(n => n.data.purchaseOrderLineId === line.purchaseOrderLineId);
          // Lecture actuelle (sans champ version si non défini dans le client Prisma actuel)
          const currentPOL = await tx.purchaseOrderLine.findUnique({
            where: { id: line.purchaseOrderLineId },
            select: { id: true, orderedQty: true, receivedQty: true } // version retiré (schema/client ne l'expose pas)
          });
          if(!currentPOL) throw new Error('purchaseOrderLine introuvable.');
          if (normOriginal?.expectedVersion != null) {
            // Avertir côté serveur si on a reçu une version mais qu'on ne peut pas la vérifier
            console.warn('[GR] Version reçue ('+normOriginal.expectedVersion+') ignorée: champ version absent du client Prisma.');
          }
          const ordered = Number(currentPOL.orderedQty);
          const newReceived = Number(currentPOL.receivedQty) + Number(line.qtyReceived);
          const allowed = ordered * (1 + (tolerancePct/100));
          if (newReceived - allowed > 1e-9) {
            throw new Error('Réception dépasse la quantité autorisée après recalcul.');
          }
          const updated = await tx.purchaseOrderLine.update({
            where: { id: currentPOL.id },
            data: { receivedQty: newReceived.toFixed(3) },
            select: { id: true, orderedQty: true, receivedQty: true }
          });
          if ((Number(updated.receivedQty) - allowed) > 1e-9) {
            throw new Error('Course condition: dépassement après mise à jour.');
          }
        }
      }

      // Recalc PO status if relevant
      if (po) {
        const refreshed = await tx.purchaseOrder.findUnique({ where: { id: po.id }, include: { lines: true } });
        const allReceived = refreshed.lines.every(l => Number(l.receivedQty) >= Number(l.orderedQty));
        const anyReceived = refreshed.lines.some(l => Number(l.receivedQty) > 0);
        let newStatus = refreshed.status;
        if (['APPROVED','PARTIAL'].includes(refreshed.status)) {
          if (allReceived) newStatus = 'RECEIVED'; else if (anyReceived) newStatus = 'PARTIAL';
        }
        if (newStatus !== refreshed.status) {
          await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus } });
          await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: po.id, oldStatus: refreshed.status, newStatus, note: 'Mise à jour suite réception' } });
          await audit(tx, { entityType: 'PurchaseOrder', entityId: po.id, action: 'STATUS_CHANGE', data: { from: refreshed.status, to: newStatus } });
        }
        // Auto-close if fully received and env flag enabled
        const autoClose = process.env.PO_AUTO_CLOSE_ON_RECEIVED === 'true';
        if (autoClose && newStatus === 'RECEIVED') {
          const closed = await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'CLOSED' } });
          await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: po.id, oldStatus: 'RECEIVED', newStatus: 'CLOSED', note: 'Auto close' } });
          await audit(tx, { entityType: 'PurchaseOrder', entityId: po.id, action: 'AUTO_CLOSE', data: { from: newStatus, to: 'CLOSED' } });
        }
      }

      return gr.id;
    });
    const full = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: { supplier: true, purchaseOrder: true, lines: { include: { product: true, purchaseOrderLine: true } } }
    });
    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error('POST /goods-receipts error', e);
    if (e.message?.includes('Réception excédant')) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message?.includes('invalide')) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: 'Erreur création réception.' }, { status: 500 });
  }
}
