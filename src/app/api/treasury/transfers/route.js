import { NextResponse } from 'next/server';
import { createTransfer } from '@/lib/serverActions/money';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
  const { fromMoneyAccountId, toMoneyAccountId, amount, description, voucherRef } = body;
  // voucherRef is currently ignored because createTransfer generates a shared ref for both legs,
  // but we keep it for forward compatibility (could override generation later).
  const result = await createTransfer({
    companyId,
    fromMoneyAccountId,
    toMoneyAccountId,
    amount,
    description,
    voucherRef,
  });
    return NextResponse.json({ ok: true, transfer: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
