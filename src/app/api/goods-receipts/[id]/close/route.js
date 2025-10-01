import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/goods-receipts/[id]/close
export async function POST(_request, { params }) {
  const { id } = params;
  try {
    const gr = await prisma.goodsReceipt.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!gr) return NextResponse.json({ error: 'Réception introuvable.' }, { status: 404 });
    if (gr.status !== 'OPEN') return NextResponse.json({ error: 'Réception déjà fermée ou statut incompatible.' }, { status: 409 });
    const updated = await prisma.goodsReceipt.update({ where: { id }, data: { status: 'CLOSED' } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Close GoodsReceipt error', e);
    return NextResponse.json({ error: 'Erreur clôture réception.' }, { status: 500 });
  }
}
