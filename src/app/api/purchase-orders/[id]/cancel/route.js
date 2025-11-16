import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { audit } from '@/lib/audit';

// POST /api/purchase-orders/[id]/cancel
// Annule un bon de commande en statut DRAFT ou APPROVED (tant qu'aucune réception n'a eu lieu)
export async function POST(_request, rawContext) {
  try {
    const context = await rawContext;
    const id = context?.params?.id;
    if (!id) return NextResponse.json({ error: 'Paramètre id manquant.' }, { status: 400 });
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true, goodsReceipts: true } });
    if (!po) return NextResponse.json({ error: 'Bon de commande introuvable.' }, { status: 404 });
    if (['CANCELLED','CLOSED'].includes(po.status)) {
      return NextResponse.json({ error: `BC déjà ${po.status.toLowerCase()}.` }, { status: 409 });
    }
    // Interdire si réceptions déjà existantes (PARTIAL / RECEIVED implicite)
    if (po.goodsReceipts.length > 0 || ['PARTIAL','RECEIVED'].includes(po.status)) {
      return NextResponse.json({ error: 'Impossible d\'annuler: réceptions déjà enregistrées.' }, { status: 409 });
    }
    if (!['DRAFT','APPROVED'].includes(po.status)) {
      return NextResponse.json({ error: `Statut ${po.status} non annulable.` }, { status: 409 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: id, oldStatus: po.status, newStatus: 'CANCELLED', note: 'Annulation manuelle' } });
      await audit(tx, { entityType: 'PurchaseOrder', entityId: id, action: 'CANCEL', data: { from: po.status, to: 'CANCELLED' } });
      return up;
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error('Cancel PO error', e);
    return NextResponse.json({ error: 'Erreur annulation PO.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
