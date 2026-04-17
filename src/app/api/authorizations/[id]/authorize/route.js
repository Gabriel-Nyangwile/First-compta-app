import { NextResponse } from 'next/server';
import { authorizeAuthorization } from '@/lib/serverActions/authorization';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    const updated = await authorizeAuthorization(id, companyId);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
