import { NextResponse } from 'next/server';
import { getSupplierLedger } from '@/lib/serverActions/ledgers';

export async function GET(req, rawCtx) {
  try {
    const { params } = await rawCtx; // Next.js 15: params is a Promise
    const { searchParams } = new URL(req.url);
    const dateStart = searchParams.get('dateStart') || undefined;
    const dateEnd = searchParams.get('dateEnd') || undefined;
    const includeDetails = searchParams.get('includeDetails') === '1';
    const data = await getSupplierLedger({ id: params.id, dateStart, dateEnd, includeDetails });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
