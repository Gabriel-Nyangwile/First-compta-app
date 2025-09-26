import { NextResponse } from 'next/server';
import { createAuthorization, listAuthorizations } from '@/lib/serverActions/authorization';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const docType = searchParams.get('docType') || undefined;
  const flow = searchParams.get('flow') || undefined;
  const rows = await listAuthorizations({ status, docType, flow, limit: 100 });
  return NextResponse.json(rows);
}

export async function POST(req) {
  try {
    const data = await req.json();
    const auth = await createAuthorization(data);
    return NextResponse.json(auth, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
