import { NextResponse } from 'next/server';

// Contract API deprecated/removed
export async function GET() {
  return NextResponse.json({ error: 'Contract API has been removed' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: 'Contract API has been removed' }, { status: 410 });
}
