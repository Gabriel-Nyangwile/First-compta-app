import { NextResponse } from 'next/server';
import { createMoneyAccount } from '@/lib/serverActions/money';

// POST /api/treasury/accounts/create  { type: 'BANK'|'CASH', label, code?, currency?, openingBalance? }
export async function POST(req) {
  try {
    const body = await req.json();
    const { type, label, code, currency, openingBalance } = body || {};
    const acc = await createMoneyAccount({ type, label, code, currency, openingBalance });
    return NextResponse.json({ ok: true, account: acc });
  } catch (e) {
    console.error('create money account error', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
