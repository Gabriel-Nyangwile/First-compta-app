import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      category: true,
      depreciationLines: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      disposals: true,
    },
  });
  if (!asset) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, asset });
}

export async function PUT(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const updated = await prisma.asset.update({
      where: { id },
      data: {
        label: body.label,
        categoryId: body.categoryId,
        acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : undefined,
        inServiceDate: body.inServiceDate ? new Date(body.inServiceDate) : undefined,
        cost: body.cost !== undefined ? Number(body.cost) : undefined,
        salvage: body.salvage !== undefined ? Number(body.salvage) : undefined,
        usefulLifeMonths: body.usefulLifeMonths ? Number(body.usefulLifeMonths) : undefined,
        status: body.status,
        meta: body.meta,
      },
    });
    return NextResponse.json({ ok: true, asset: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    await prisma.depreciationLine.deleteMany({ where: { assetId: id } });
    await prisma.assetDisposal.deleteMany({ where: { assetId: id } });
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Delete failed' }, { status: 500 });
  }
}
