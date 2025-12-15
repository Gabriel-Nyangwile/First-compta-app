import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const po = await prisma.assetPurchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { assetCategory: true } }, incomingInvoice: { select: { id: true, entryNumber: true, supplierInvoiceNumber: true } } },
  });
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(po);
}
