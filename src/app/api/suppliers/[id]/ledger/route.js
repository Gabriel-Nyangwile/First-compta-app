import { NextResponse } from 'next/server';
import { getSupplierLedger } from '@/lib/serverActions/ledgers';

// Helper to resolve potential promise-based context/params (Next.js 15+ dynamic API routes)
async function resolveParams(maybeCtx) {
  let ctx = maybeCtx;
  if (ctx && typeof ctx.then === 'function') ctx = await ctx; // context itself is a promise
  let p = ctx?.params ?? ctx;
  if (p && typeof p.then === 'function') p = await p; // params is a promise
  return p || {};
}

export async function GET(request, context) {
  try {
    const params = await resolveParams(context);
    if (!params.id) return NextResponse.json({ error: 'param id manquant' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';

    const data = await getSupplierLedger({ id: params.id, dateStart, dateEnd, includeDetails });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Erreur inconnue' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
