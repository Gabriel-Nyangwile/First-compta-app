import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkPerm, getUserRole } from '@/lib/authz';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  const asset = await prisma.asset.findUnique({
    where: { id, companyId },
    include: {
      category: true,
      depreciationLines: { where: { companyId }, orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      disposals: { where: { companyId } },
    },
  });
  if (!asset) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, asset });
}

export async function PUT(req, { params }) {
  const companyId = requireCompanyId(req);
  const role = await getUserRole(req);
  if (!checkPerm('createAsset', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const updated = await prisma.asset.update({
      where: { id, companyId },
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

export async function DELETE(req, { params }) {
  const companyId = requireCompanyId(req);
  const role = await getUserRole(req);
  if (!checkPerm('createAsset', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    await prisma.depreciationLine.deleteMany({ where: { assetId: id, companyId } });
    await prisma.assetDisposal.deleteMany({ where: { assetId: id, companyId } });
    await prisma.asset.delete({ where: { id, companyId } });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Delete failed' }, { status: 500 });
  }
}
