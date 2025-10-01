import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/margins?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const dateFilter = {};
  if (from || to) {
    dateFilter.gte = from ? new Date(from) : undefined;
    dateFilter.lte = to ? new Date(to) : undefined;
  }
  try {
    const invoices = await prisma.invoice.findMany({
      where: Object.keys(dateFilter).length ? { issueDate: dateFilter } : {},
      include: { invoiceLines: { include: { product: true, stockMovements: { where: { movementType: 'OUT' } } } } }
    });
    let revenue = 0, cogs = 0;
    for (const inv of invoices) {
      for (const line of inv.invoiceLines) {
        revenue += Number(line.lineTotal);
        for (const mv of line.stockMovements) {
          cogs += Number(mv.totalCost || 0);
        }
      }
    }
    const gross = revenue - cogs;
    const pct = revenue ? gross / revenue : 0;
    return NextResponse.json({ from, to, revenueHt: revenue, cogs, grossMargin: gross, grossMarginPct: + (pct * 100).toFixed(2) });
  } catch (e) {
    console.error('Margins error', e);
    return NextResponse.json({ error: 'Erreur calcul marge.' }, { status: 500 });
  }
}
