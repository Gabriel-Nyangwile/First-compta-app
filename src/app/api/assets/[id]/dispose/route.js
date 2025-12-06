import { NextResponse } from 'next/server';
import { disposeAsset } from '@/lib/assets';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const result = await disposeAsset(id, {
      date: body.date,
      proceed: body.proceed,
      proceedAccountNumber: body.proceedAccountNumber,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Dispose failed' }, { status: 500 });
  }
}
