import { NextResponse } from 'next/server';
import { authorizeAuthorization } from '@/lib/serverActions/authorization';

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const updated = await authorizeAuthorization(id);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
