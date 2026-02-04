import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

async function resolveParams(maybeCtx) {
  let ctx = maybeCtx;
  if (ctx && typeof ctx.then === 'function') ctx = await ctx;
  let p = ctx?.params ?? ctx;
  if (p && typeof p.then === 'function') p = await p;
  return p || {};
}

// POST /api/goods-receipts/[id]/close
export async function POST(request, rawContext) {
  const companyId = requireCompanyId(request);
  const params = await resolveParams(rawContext);
  const id = params?.id;
  try {
    const gr = await prisma.goodsReceipt.findUnique({ where: { id, companyId }, select: { id: true, status: true } });
    if (!gr) return NextResponse.json({ error: 'Réception introuvable.' }, { status: 404 });
    if (gr.status !== 'OPEN') return NextResponse.json({ error: 'Réception déjà fermée ou statut incompatible.' }, { status: 409 });
    const updated = await prisma.goodsReceipt.update({ where: { id, companyId }, data: { status: 'CLOSED' } });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('Close GoodsReceipt error', e);
    return NextResponse.json({ error: 'Erreur clôture réception.' }, { status: 500 });
  }
}
