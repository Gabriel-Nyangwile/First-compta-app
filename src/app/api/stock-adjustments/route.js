import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyAdjustMovement } from '@/lib/inventory';
import { requireCompanyId } from '@/lib/tenant';

// POST /api/stock-adjustments { productId, qty, unitCost? }
export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const body = await request.json();
    const productId = body.productId;
    const qty = Number(body.qty);
    const unitCost = body.unitCost != null ? Number(body.unitCost) : undefined;
    if (!productId || isNaN(qty) || qty === 0) {
      return NextResponse.json({ error: 'productId et qty non nul requis.' }, { status: 400 });
    }
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
    }
    const movementId = await prisma.$transaction(async (tx) => {
      const adj = await applyAdjustMovement(tx, {
        productId,
        qty,
        unitCost,
        companyId,
      });
      const mv = await tx.stockMovement.create({
        data: {
          companyId,
          productId,
            movementType: 'ADJUST',
            quantity: qty.toFixed(3),
            unitCost: adj.unitCost != null ? Number(adj.unitCost).toFixed(4) : null,
            totalCost: adj.totalCost != null ? Number(adj.totalCost).toFixed(2) : null
        }
      });
      return mv.id;
    });
    const full = await prisma.stockMovement.findUnique({ where: { id: movementId } });
    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    if (e.message?.includes('unitCost requis') || e.message?.includes('Stock insuffisant')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('POST /stock-adjustments error', e);
    return NextResponse.json({ error: 'Erreur ajustement stock.' }, { status: 500 });
  }
}
