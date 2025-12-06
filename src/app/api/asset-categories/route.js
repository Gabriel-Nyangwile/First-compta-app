import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await prisma.assetCategory.findMany({
      orderBy: { code: 'asc' },
    });
    return NextResponse.json({ ok: true, categories });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Failed to list asset categories' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { code, label, durationMonths } = body;
    if (!code || !label || !durationMonths) {
      return NextResponse.json({ ok: false, error: 'code, label, durationMonths requis' }, { status: 400 });
    }
    const created = await prisma.assetCategory.create({
      data: {
        code,
        label,
        durationMonths: Number(durationMonths),
        method: body.method || 'LINEAR',
        assetAccountId: body.assetAccountId || null,
        assetAccountNumber: body.assetAccountNumber || null,
        depreciationAccountId: body.depreciationAccountId || null,
        depreciationAccountNumber: body.depreciationAccountNumber || null,
        expenseAccountId: body.expenseAccountId || null,
        expenseAccountNumber: body.expenseAccountNumber || null,
        disposalGainAccountId: body.disposalGainAccountId || null,
        disposalGainAccountNumber: body.disposalGainAccountNumber || null,
        disposalLossAccountId: body.disposalLossAccountId || null,
        disposalLossAccountNumber: body.disposalLossAccountNumber || null,
        active: body.active ?? true,
      },
    });
    return NextResponse.json({ ok: true, category: created });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Failed to create asset category' }, { status: 500 });
  }
}
