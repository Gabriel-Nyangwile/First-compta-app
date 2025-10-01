import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyAdjustMovement } from '@/lib/inventory';

// POST /api/goods-receipts/[id]/cancel
// Payload: { reason?, lines?: [goodsReceiptLineId] } (if lines absent -> full cancel)
export async function POST(request, ctx) {
  try {
    const id = ctx?.params?.id;
    if (!id) return NextResponse.json({ error: 'Paramètre id manquant.' }, { status: 400 });
    const body = await request.json().catch(()=>({}));
    const selectedLines = Array.isArray(body.lines) && body.lines.length ? body.lines : null;
    const reason = body.reason || 'Annulation réception';

    const result = await prisma.$transaction(async (tx) => {
      const gr = await tx.goodsReceipt.findUnique({ where: { id }, include: { lines: true, purchaseOrder: { include: { lines: true } } } });
      if (!gr) throw new Error('Réception introuvable.');
      if (gr.status !== 'OPEN') throw new Error('Annulation impossible: statut non OPEN.');

      const linesToCancel = selectedLines ? gr.lines.filter(l => selectedLines.includes(l.id)) : gr.lines;
      if (!linesToCancel.length) throw new Error('Aucune ligne à annuler.');

      for (const line of linesToCancel) {
        const qty = Number(line.qtyReceived);
        // Reverser stock: ajustement négatif au coût moyen courant (approx) -> on sort la quantité reçue.
        await applyAdjustMovement(tx, { productId: line.productId, qty: -qty });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            movementType: 'ADJUST',
            quantity: (-qty).toFixed(3),
            unitCost: null,
            totalCost: null,
            goodsReceiptLineId: line.id
          }
        });
        if (line.purchaseOrderLineId) {
          await tx.purchaseOrderLine.update({ where: { id: line.purchaseOrderLineId }, data: { receivedQty: { decrement: line.qtyReceived }, version: { increment: 1 } } });
        }
      }

      // Recompute PO status if linked
      if (gr.purchaseOrder) {
        const po = await tx.purchaseOrder.findUnique({ where: { id: gr.purchaseOrder.id }, include: { lines: true } });
        const allReceived = po.lines.every(l => Number(l.receivedQty) >= Number(l.orderedQty));
        const anyReceived = po.lines.some(l => Number(l.receivedQty) > 0);
        let newStatus = po.status;
        if (['PARTIAL','RECEIVED'].includes(po.status)) {
          if (allReceived) newStatus = 'RECEIVED'; else if (anyReceived) newStatus = 'PARTIAL'; else newStatus = 'APPROVED';
        }
        if (newStatus !== po.status) {
          await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus } });
          await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: po.id, oldStatus: po.status, newStatus, note: 'Annulation réception' } });
        }
      }

      return { cancelledLines: linesToCancel.length };
    });

    return NextResponse.json({ message: 'Annulation effectuée.', ...result });
  } catch (e) {
    console.error('Annulation réception error', e);
    return NextResponse.json({ error: e.message || 'Erreur annulation.' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
