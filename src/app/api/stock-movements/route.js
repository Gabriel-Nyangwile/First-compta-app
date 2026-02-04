import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/stock-movements?productId=&type=&limit=100
export async function GET(request) {
  const companyId = requireCompanyId(request);
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');
  const type = searchParams.get('type');
  const limit = Math.min(Number(searchParams.get('limit')||100), 500);
  const where = { companyId };
  if (productId) where.productId = productId;
  if (type) where.movementType = type;
  try {
    const rows = await prisma.stockMovement.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: { product: true }
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /stock-movements error', e);
    return NextResponse.json({ error: 'Erreur récupération mouvements.' }, { status: 500 });
  }
}
