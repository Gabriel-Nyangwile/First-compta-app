import { NextResponse } from 'next/server';
import { getClientLedger } from '@/lib/serverActions/ledgers';
import { requireCompanyId } from '@/lib/tenant';

async function resolveParams(maybeCtx) {
  let ctx = maybeCtx;
  if (ctx && typeof ctx.then === 'function') ctx = await ctx;
  let p = ctx?.params ?? ctx;
  if (p && typeof p.then === 'function') p = await p;
  return p || {};
}

export async function GET(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const params = await resolveParams(context);
    if (!params.id) return NextResponse.json({ error: 'param id manquant' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';

    const data = await getClientLedger({ id: params.id, companyId, dateStart, dateEnd, includeDetails });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Erreur inconnue' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
