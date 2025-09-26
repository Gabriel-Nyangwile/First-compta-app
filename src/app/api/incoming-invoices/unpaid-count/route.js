import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/incoming-invoices/unpaid-count
export async function GET() {
  try {
    const count = await prisma.incomingInvoice.count({ where: { status: { not: 'PAID' } } });
    return NextResponse.json({ count });
  } catch (e) {
    console.error('unpaid-count incoming invoices error', e);
    return NextResponse.json({ error: 'Erreur comptage factures reçues impayées' }, { status: 500 });
  }
}
