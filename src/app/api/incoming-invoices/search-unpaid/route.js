import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireCompanyId } from '@/lib/tenant';

// GET /api/incoming-invoices/search-unpaid?query=...&limit=20
// Retourne factures fournisseurs non soldées (PENDING / PARTIAL / OVERDUE)
export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('query')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 100);
    const where = {
      companyId,
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      ...(q
        ? {
            OR: [
              { entryNumber: { contains: q, mode: 'insensitive' } },
              { supplierInvoiceNumber: { contains: q, mode: 'insensitive' } },
              { supplier: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}
      )
    };
    const rows = await prisma.incomingInvoice.findMany({
      where,
      orderBy: { receiptDate: 'desc' },
      take: limit,
      select: { id: true, entryNumber: true, supplierInvoiceNumber: true, receiptDate: true, totalAmount: true, status: true, paidAmount: true, outstandingAmount: true, supplier: { select: { name: true } } }
    });
    return NextResponse.json(rows.map(r => ({
      ...r,
      paid: Number(r.paidAmount || 0),
      remaining: Number(r.outstandingAmount != null ? r.outstandingAmount : (Number(r.totalAmount) - Number(r.paidAmount || 0)))
    })));
  } catch (e) {
    console.error('search-unpaid incoming invoices error', e);
    return NextResponse.json({ error: 'Erreur recherche factures reçues impayées' }, { status: 500 });
  }
}
