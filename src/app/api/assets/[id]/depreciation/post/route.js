import { NextResponse } from 'next/server';
import { postDepreciation } from '@/lib/assets';
import { checkPerm } from '@/lib/authz';
import { getRequestRole } from '@/lib/requestAuth';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm('postDepreciation', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: false, error: 'Method not allowed. Use POST.' }, { status: 405 });
}

export async function POST(req, { params }) {
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm('postDepreciation', role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!year || !month) return NextResponse.json({ ok: false, error: 'year et month requis' }, { status: 400 });
    const result = await postDepreciation(id, year, month, companyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e.message || 'Post failed';
    const lower = msg.toLowerCase();
    const isPosted = lower.includes('deja post');
    const isLocked = lower.includes('verrouillee');
    const status = isPosted || isLocked ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
