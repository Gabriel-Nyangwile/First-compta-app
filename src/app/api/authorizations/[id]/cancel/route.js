import { NextResponse } from 'next/server';
import { cancelAuthorization } from '@/lib/serverActions/authorization';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    const updated = await cancelAuthorization(id, companyId);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
