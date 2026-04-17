import { NextResponse } from 'next/server';
import { linkBankAdviceToMovement } from '@/lib/serverActions/authorization';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    const body = await req.json();
    const { moneyAccountId, description } = body;
    const mv = await linkBankAdviceToMovement({ bankAdviceId: id, moneyAccountId, description, companyId });
    return NextResponse.json(mv, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
