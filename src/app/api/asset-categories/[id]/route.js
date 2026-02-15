import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  const category = await prisma.assetCategory.findUnique({ where: { id, companyId } });
  if (!category) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, category });
}

export async function PUT(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const updated = await prisma.assetCategory.update({
      where: { id, companyId },
      data: {
        code: body.code,
        label: body.label,
        durationMonths: body.durationMonths ? Number(body.durationMonths) : undefined,
        method: body.method,
        assetAccountId: body.assetAccountId,
        assetAccountNumber: body.assetAccountNumber,
        depreciationAccountId: body.depreciationAccountId,
        depreciationAccountNumber: body.depreciationAccountNumber,
        expenseAccountId: body.expenseAccountId,
        expenseAccountNumber: body.expenseAccountNumber,
        disposalGainAccountId: body.disposalGainAccountId,
        disposalGainAccountNumber: body.disposalGainAccountNumber,
        disposalLossAccountId: body.disposalLossAccountId,
        disposalLossAccountNumber: body.disposalLossAccountNumber,
        active: body.active,
      },
    });
    return NextResponse.json({ ok: true, category: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    await prisma.assetCategory.delete({ where: { id, companyId } });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Delete failed' }, { status: 500 });
  }
}
