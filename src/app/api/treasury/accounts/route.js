import { NextResponse } from 'next/server';
import { listMoneyAccountsWithBalance } from '@/lib/serverActions/money';

export async function GET() {
  try {
    const data = await listMoneyAccountsWithBalance();
    return NextResponse.json({ ok: true, accounts: data.map(a => ({
      id: a.id,
      type: a.type,
      label: a.label,
      code: a.code,
      ledgerAccountId: a.ledgerAccountId,
      openingBalance: a.openingBalance,
      computedBalance: a.computedBalance,
      currency: a.currency,
      isActive: a.isActive
    })) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
