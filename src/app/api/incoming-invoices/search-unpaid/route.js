import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/incoming-invoices/search-unpaid?query=...&limit=20
// Retourne factures fournisseurs non soldées (PENDING / PARTIAL / OVERDUE)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('query')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const where = {
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      ...(q ? { entryNumber: { contains: q, mode: 'insensitive' } } : {})
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
