import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createAsset } from '@/lib/assets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const assets = await prisma.asset.findMany({
      include: {
        category: true,
        depreciationLines: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
        disposals: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
    return NextResponse.json({ ok: true, assets });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Failed to list assets' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const required = ['label', 'categoryId', 'acquisitionDate', 'cost', 'usefulLifeMonths'];
    for (const key of required) {
      if (body[key] === undefined || body[key] === null || body[key] === '') {
        return NextResponse.json({ ok: false, error: `${key} requis` }, { status: 400 });
      }
    }
    const asset = await createAsset({
      label: body.label,
      categoryId: body.categoryId,
      acquisitionDate: body.acquisitionDate,
      inServiceDate: body.inServiceDate || body.acquisitionDate,
      cost: Number(body.cost),
      salvage: body.salvage ? Number(body.salvage) : 0,
      usefulLifeMonths: Number(body.usefulLifeMonths),
      method: body.method || 'LINEAR',
      status: body.status || 'ACTIVE',
      meta: body.meta || null,
    });
    return NextResponse.json({ ok: true, asset });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Failed to create asset' }, { status: 500 });
  }
}
