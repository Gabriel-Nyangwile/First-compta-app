import { NextResponse } from 'next/server';
import { postDepreciation } from '@/lib/assets';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year et month requis' }, { status: 400 });
    const result = await postDepreciation(id, year, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Post failed' }, { status: 500 });
  }
}
