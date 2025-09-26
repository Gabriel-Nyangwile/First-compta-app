import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET /api/invoices/search-unpaid?query=...&limit=20
// Retourne les factures client non soldées (PENDING ou PARTIAL)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('query')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const where = {
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      ...(q ? { invoiceNumber: { contains: q, mode: 'insensitive' } } : {})
    };
    const rows = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      take: limit,
      select: { id: true, invoiceNumber: true, issueDate: true, totalAmount: true, status: true, paidAmount: true, outstandingAmount: true, client: { select: { name: true } } }
    });
    // Utilise désormais les champs persistés paidAmount / outstandingAmount (backfill requis pour l'historique)
    return NextResponse.json(rows.map(r => ({
      ...r,
      paid: Number(r.paidAmount || 0),
      remaining: Number(r.outstandingAmount != null ? r.outstandingAmount : (Number(r.totalAmount) - Number(r.paidAmount || 0)))
    })));
  } catch (e) {
    console.error('search-unpaid invoices error', e);
    return NextResponse.json({ error: 'Erreur recherche factures impayées' }, { status: 500 });
  }
}
