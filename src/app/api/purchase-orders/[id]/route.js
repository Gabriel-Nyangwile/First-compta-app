import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/purchase-orders/[id]
// Retourne les détails complets du bon de commande :
// - supplier
// - lines (avec remainingQty)
// - goodsReceipts (et leurs lines)
// - summary (statistiques de réception)
export async function GET(_request, rawContext) {
  try {
    const context = await rawContext; // handle potential async params in Next 15
    const id = context?.params?.id;
    if (!id) {
      return NextResponse.json({ error: "Paramètre id manquant." }, { status: 400 });
    }
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        lines: { include: { product: true } },
        goodsReceipts: { include: { lines: { include: { product: true, purchaseOrderLine: true } } } },
        statusLogs: { orderBy: { changedAt: 'asc' } }
      }
    });
    if (!po) return NextResponse.json({ error: 'Bon de commande introuvable.' }, { status: 404 });

    const lines = po.lines.map(l => {
      const ordered = Number(l.orderedQty);
      const received = Number(l.receivedQty);
      const remaining = +(ordered - received).toFixed(3);
      return {
        ...l,
        orderedQty: ordered,
        receivedQty: received,
        remainingQty: remaining
      };
    });

    const fullyReceivedLines = lines.filter(l => l.remainingQty <= 1e-9).length;
    const anyReceived = lines.some(l => l.receivedQty > 0);
    const allReceived = fullyReceivedLines === lines.length && lines.length > 0;

    const summary = {
      totalLines: lines.length,
      fullyReceivedLines,
      partiallyReceivedLines: lines.filter(l => l.receivedQty > 0 && l.remainingQty > 1e-9).length,
      notReceivedLines: lines.filter(l => l.receivedQty <= 1e-9).length,
      anyReceived,
      allReceived
    };

    return NextResponse.json({
      id: po.id,
      number: po.number,
      status: po.status,
      issueDate: po.issueDate,
      expectedDate: po.expectedDate,
      currency: po.currency,
      notes: po.notes,
      supplier: po.supplier,
      lines,
      goodsReceipts: po.goodsReceipts,
      statusLogs: po.statusLogs || [],
      summary
    });
  } catch (e) {
    console.error('GET /purchase-orders/[id] error', e);
    return NextResponse.json({ error: 'Erreur récupération bon de commande.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
