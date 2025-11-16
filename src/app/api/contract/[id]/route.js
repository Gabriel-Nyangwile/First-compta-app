import { NextResponse } from 'next/server';

// Contract detail API deprecated/removed
export async function GET() { return NextResponse.json({ error: 'Contract API removed' }, { status: 410 }); }
export async function PUT() { return NextResponse.json({ error: 'Contract API removed' }, { status: 410 }); }
export async function DELETE() { return NextResponse.json({ error: 'Contract API removed' }, { status: 410 }); }
