import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const po = await prisma.assetPurchaseOrder.findUnique({
    where: { id, companyId },
    include: { supplier: true, lines: { include: { assetCategory: true } }, incomingInvoice: { select: { id: true, entryNumber: true, supplierInvoiceNumber: true } } },
  });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(po);
}
