import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/invoices/unpaid-count
export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const count = await prisma.invoice.count({
      where: { status: { not: 'PAID' }, companyId },
    });
    return NextResponse.json({ count });
  } catch (e) {
    console.error('unpaid-count invoices error', e);
    if (String(e?.message || '').includes('companyId requis')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur comptage factures impayees' }, { status: 500 });
  }
}
