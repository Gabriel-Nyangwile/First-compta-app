import { NextResponse } from 'next/server';
import { postDepreciationBatch } from '@/lib/assets';
import { checkPerm, getUserRole } from '@/lib/authz';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const role = await getUserRole(req);
  if (!checkPerm('postDepreciation', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year et month requis' }, { status: 400 });
    const result = await postDepreciationBatch(year, month, companyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || 'Post batch failed';
    const lower = msg.toLowerCase();
    const isPosted = lower.includes('deja post');
    const isLocked = lower.includes('verrouillee');
    const status = isPosted || isLocked ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
