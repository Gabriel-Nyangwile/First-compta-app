import { NextResponse } from 'next/server';
import { postDepreciationBatch } from '@/lib/assets';
import { checkPerm, getUserRole } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const role = await getUserRole(req);
  if (!checkPerm('postDepreciation', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year et month requis' }, { status: 400 });
    const result = await postDepreciationBatch(year, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || 'Post batch failed';
    const status = msg.toLowerCase().includes('deja post') ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
