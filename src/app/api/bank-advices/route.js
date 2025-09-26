import { NextResponse } from 'next/server';
import { createBankAdvice, listBankAdvices } from '@/lib/serverActions/authorization';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const adviceType = searchParams.get('type') || undefined;
  const authorizationId = searchParams.get('authorizationId') || undefined;
  const rows = await listBankAdvices({ adviceType, authorizationId, limit: 100 });
  return NextResponse.json(rows);
}

export async function POST(req) {
  try {
    const data = await req.json();
    const advice = await createBankAdvice(data);
    return NextResponse.json(advice, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
