import { NextResponse } from 'next/server';
import { listMoneyMovements } from '@/lib/serverActions/money';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const cursor = searchParams.get('cursor') || undefined;
  try {
    const { rows, nextCursor } = await listMoneyMovements({
      companyId,
      moneyAccountId: id,
      limit,
      cursor,
    });
    return NextResponse.json({ ok: true, movements: rows, nextCursor });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
