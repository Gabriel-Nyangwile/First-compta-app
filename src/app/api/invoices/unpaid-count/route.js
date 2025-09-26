import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/invoices/unpaid-count
export async function GET() {
  try {
    const count = await prisma.invoice.count({ where: { status: { not: 'PAID' } } });
    return NextResponse.json({ count });
  } catch (e) {
    console.error('unpaid-count invoices error', e);
    return NextResponse.json({ error: 'Erreur comptage factures impayées' }, { status: 500 });
  }
}
