import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/purchase-orders/[id]/export.csv
export async function GET(_req, rawContext) {
  try {
    const context = await rawContext;
    const id = context?.params?.id;
    if (!id) return NextResponse.json({ error: 'Paramètre id manquant.' }, { status: 400 });
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { product: true } } }
    });
    if (!po) return NextResponse.json({ error: 'Bon de commande introuvable.' }, { status: 404 });

    const header = ['PO Number','Status','Supplier','Line Product','Ordered Qty','Received Qty','Remaining Qty','Unit Price'];
    const rows = po.lines.map(l => {
      const ordered = Number(l.orderedQty);
      const received = Number(l.receivedQty);
      const remaining = +(ordered - received).toFixed(3);
      return [
        po.number,
        po.status,
        po.supplier?.name || '',
        l.product?.name || l.productId,
        ordered,
        received,
        remaining,
        Number(l.unitPrice).toFixed(4)
      ];
    });
    const csv = [header, ...rows].map(r => r.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return '"' + cell.replace(/"/g,'""') + '"';
      }
      return cell;
    }).join(',')).join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${po.number}.csv"`
      }
    });
  } catch (e) {
    console.error('Export CSV PO error', e);
    return NextResponse.json({ error: 'Erreur export CSV.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
