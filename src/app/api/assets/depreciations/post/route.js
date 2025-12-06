import { NextResponse } from 'next/server';
import { postDepreciationBatch } from '@/lib/assets';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year et month requis' }, { status: 400 });
    const result = await postDepreciationBatch(year, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || 'Post batch failed';
    const status = msg.includes('déjà postées') ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
