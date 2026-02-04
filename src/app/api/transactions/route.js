import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

/*
  GET /api/transactions
  Query params pris en charge:
    - dateStart (ISO date)
    - dateEnd (ISO date)
    - clientId
    - invoiceId
    - direction (DEBIT|CREDIT)
    - kind (RECEIVABLE|SALE|VAT_COLLECTED|PAYMENT)
    - page (>=1)
    - pageSize (<=100, défaut 50)
  Réponse:
    { data: [...], page, pageSize, total, totalPages, sums: { debit, credit } }
*/
export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
  const clientId = searchParams.get('clientId');
  const supplierId = searchParams.get('supplierId');
    const invoiceId = searchParams.get('invoiceId');
    const direction = searchParams.get('direction');
    const kind = searchParams.get('kind');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const where = { companyId };
    if (dateStart || dateEnd) {
      where.date = {};
      if (dateStart) where.date.gte = new Date(dateStart);
      if (dateEnd) {
        // inclure toute la journée dateEnd
        const end = new Date(dateEnd);
        end.setHours(23,59,59,999);
        where.date.lte = end;
      }
    }
    if (clientId) where.clientId = clientId;
  if (invoiceId) where.invoiceId = invoiceId;
  if (supplierId) where.supplierId = supplierId;
    if (direction) where.direction = direction;
    if (kind) where.kind = kind;

    const skip = (page - 1) * pageSize;

    const [rawData, total, aggregates] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
            invoice: { select: { id: true, invoiceNumber: true } },
            invoiceLine: { select: { id: true, description: true, accountId: true } },
            incomingInvoice: { select: { id: true, entryNumber: true } },
            incomingInvoiceLine: { select: { id: true, description: true, accountId: true } },
          account: { select: { id: true, number: true, label: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ['direction'],
        where,
        _sum: { amount: true }
      })
    ]);

    // Post-traitement simplifié : chaque écriture SALE/PURCHASE correspond maintenant à UNE ligne
    const data = rawData.map(t => {
      // articleDescription = description de la ligne (si SALE/PURCHASE)
      let articleDescription = '';
      if (t.kind === 'SALE' && t.invoiceLine) articleDescription = t.invoiceLine.description;
      if (t.kind === 'PURCHASE' && t.incomingInvoiceLine) articleDescription = t.incomingInvoiceLine.description;
      return { ...t, lineDescription: articleDescription };
    });

    let debit = 0, credit = 0;
    aggregates.forEach(a => {
      if (a.direction === 'DEBIT') debit += Number(a._sum.amount || 0);
      if (a.direction === 'CREDIT') credit += Number(a._sum.amount || 0);
    });

    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      sums: { debit, credit }
    });
  } catch (e) {
    console.error('Erreur listing transactions:', e);
    return NextResponse.json({ error: 'Erreur récupération transactions.' }, { status: 500 });
  }
}
