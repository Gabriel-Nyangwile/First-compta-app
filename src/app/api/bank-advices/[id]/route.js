import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(req, { params }) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });
  try {
    await prisma.bankAdvice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
