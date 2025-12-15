import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const allowedTransitions = {
  DRAFT: ['APPROVED'],
  APPROVED: ['RECEIVED'],
  RECEIVED: ['INVOICED'],
  INVOICED: [],
};

export async function POST(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  try {
    const body = await req.json();
    const status = body.status;
    if (!status) return NextResponse.json({ error: 'status requis' }, { status: 400 });
    const po = await prisma.assetPurchaseOrder.findUnique({ where: { id } });
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const nexts = allowedTransitions[po.status] || [];
    if (!nexts.includes(status)) return NextResponse.json({ error: `Transition ${po.status} -> ${status} interdite` }, { status: 409 });
    const updated = await prisma.assetPurchaseOrder.update({
      where: { id },
      data: {
        status,
        receivedAt: status === 'RECEIVED' && !po.receivedAt ? new Date() : po.receivedAt,
      },
    });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Maj statut échouée' }, { status: 500 });
  }
}
