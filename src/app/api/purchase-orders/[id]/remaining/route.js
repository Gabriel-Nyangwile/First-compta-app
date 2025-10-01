import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/purchase-orders/[id]/remaining
// Retourne uniquement les lignes avec quantité restante > 0 + résumé.
export async function GET(_request, rawContext) {
  try {
    const context = await rawContext;
    const id = context?.params?.id;
    if (!id) return NextResponse.json({ error: 'Paramètre id manquant.' }, { status: 400 });

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } }
    });
    if (!po) return NextResponse.json({ error: 'Bon de commande introuvable.' }, { status: 404 });

    const allLines = po.lines.map(l => {
      const ordered = Number(l.orderedQty);
      const received = Number(l.receivedQty);
      const remaining = +(ordered - received).toFixed(3);
      return { ...l, orderedQty: ordered, receivedQty: received, remainingQty: remaining };
    });

    const remainingLines = allLines.filter(l => l.remainingQty > 1e-9);
    const summary = {
      totalLines: allLines.length,
      withRemaining: remainingLines.length,
      totalRemainingQty: remainingLines.reduce((acc, l) => acc + l.remainingQty, 0),
      totalOrderedQty: allLines.reduce((acc, l) => acc + l.orderedQty, 0),
      totalReceivedQty: allLines.reduce((acc, l) => acc + l.receivedQty, 0)
    };

    return NextResponse.json({ purchaseOrderId: po.id, status: po.status, remainingLines, summary });
  } catch (e) {
    console.error('GET /purchase-orders/[id]/remaining error', e);
    return NextResponse.json({ error: 'Erreur récupération lignes restantes.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
