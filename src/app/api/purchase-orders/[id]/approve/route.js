import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { audit } from '@/lib/audit';

// POST /api/purchase-orders/[id]/approve
// Approve a purchase order currently in DRAFT status.
export async function POST(request, rawContext) {
  try {
    const context = await rawContext;
    const id = context?.params?.id;
    if (!id) {
      console.warn('Approve PO called without id param');
      return NextResponse.json({ error: 'Paramètre id manquant dans l\'URL.' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { id: true, status: true, number: true } });
    if (!po) return NextResponse.json({ error: 'PO introuvable.' }, { status: 404 });
    if (po.status !== 'DRAFT') {
      return NextResponse.json({ error: `Impossible d'approuver: statut actuel ${po.status}.` }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const up = await tx.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED' } });
      await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: id, oldStatus: po.status, newStatus: 'APPROVED', note: 'Approbation' } });
      await audit(tx, { entityType: 'PurchaseOrder', entityId: id, action: 'APPROVE', data: { from: po.status, to: 'APPROVED' } });
      return up;
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error('Approve PO error', e);
    return NextResponse.json({ error: 'Erreur approbation PO.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // ensure no static optimization interferes
