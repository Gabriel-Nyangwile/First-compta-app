import { NextResponse } from 'next/server';
import { createMoneyMovement } from '@/lib/serverActions/money';

export async function POST(req) {
  try {
    const body = await req.json();
    const movement = await createMoneyMovement(body);
    return NextResponse.json({ ok: true, movement });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
