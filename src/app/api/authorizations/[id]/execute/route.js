import { NextResponse } from 'next/server';
import { executeAuthorizationViaMovement } from '@/lib/serverActions/authorization';

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { moneyAccountId, description } = body;
    const mv = await executeAuthorizationViaMovement({ authorizationId: id, moneyAccountId, description });
    return NextResponse.json(mv, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
