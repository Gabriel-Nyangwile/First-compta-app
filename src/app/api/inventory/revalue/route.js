import { NextResponse } from 'next/server';
import { revalueProducts } from '@/lib/revalueInventory';
import { requireCompanyId } from '@/lib/tenant';

// POST /api/inventory/revalue { productIds?:[], strict?:bool }
export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const body = await request.json().catch(()=>({}));
    const { productIds = null, strict = false } = body;
    const result = await revalueProducts({ companyId, productIds, strict });
    return NextResponse.json({ result });
  } catch (e) {
    console.error('Revalue API error', e);
    return NextResponse.json({ error: 'Erreur revalorisation.' }, { status: 500 });
  }
}
