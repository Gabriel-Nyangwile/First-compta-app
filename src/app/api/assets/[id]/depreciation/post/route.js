import { NextResponse } from 'next/server';
import { postDepreciation } from '@/lib/assets';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed. Use POST.' }, { status: 405 });
}

export async function POST(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year et month requis' }, { status: 400 });
    const result = await postDepreciation(id, year, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || 'Post failed';
    const status = msg.toLowerCase().includes('deja postee') ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
