import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { audit } from '@/lib/audit';

// POST /api/purchase-orders/[id]/close
// Force manuelle de clôture: passe à CLOSED si statut actuel est RECEIVED ou APPROVED/PARTIAL sans reste.
export async function POST(_request, rawContext) {
  try {
    const context = await rawContext;
    const id = context?.params?.id;
    if (!id) return NextResponse.json({ error: 'Paramètre id manquant.' }, { status: 400 });
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!po) return NextResponse.json({ error: 'Bon de commande introuvable.' }, { status: 404 });

    const allReceived = po.lines.length > 0 && po.lines.every(l => Number(l.receivedQty) >= Number(l.orderedQty));
    // Autoriser la fermeture si déjà RECEIVED ou si plus rien à recevoir
    if (!(po.status === 'RECEIVED' || allReceived)) {
      return NextResponse.json({ error: `Statut (${po.status}) ou quantités restantes empêchent la clôture.` }, { status: 409 });
    }
    if (po.status === 'CLOSED') {
      return NextResponse.json({ message: 'Déjà fermé.' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.purchaseOrder.update({ where: { id }, data: { status: 'CLOSED' } });
      await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: id, oldStatus: po.status, newStatus: 'CLOSED', note: 'Clôture manuelle' } });
      await audit(tx, { entityType: 'PurchaseOrder', entityId: id, action: 'CLOSE', data: { from: po.status, to: 'CLOSED' } });
      return up;
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('POST /purchase-orders/[id]/close error', e);
    return NextResponse.json({ error: 'Erreur clôture manuelle PO.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
