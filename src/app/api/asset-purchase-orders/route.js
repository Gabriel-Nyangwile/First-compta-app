import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { nextSequence } from '@/lib/sequence';

function toNumber(v) { return v?.toNumber?.() ?? Number(v ?? 0); }

export async function GET() {
  try {
    const pos = await prisma.assetPurchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, lines: { include: { assetCategory: true } } },
    });
    return NextResponse.json(pos);
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Erreur liste BC immob.' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { supplierId, expectedDate, currency = 'EUR', notes, lines } = body;
    if (!supplierId) return NextResponse.json({ error: 'supplierId requis' }, { status: 400 });
    if (!Array.isArray(lines) || !lines.length) return NextResponse.json({ error: 'lines requises' }, { status: 400 });
    const norm = lines.map((l, idx) => {
      const qty = Number(l.quantity ?? 1);
      const price = Number(l.unitPrice);
      if (!l.assetCategoryId) throw new Error(`Catégorie manquante ligne ${idx + 1}`);
      if (!(qty > 0)) throw new Error(`Quantité invalide ligne ${idx + 1}`);
      if (isNaN(price) || price < 0) throw new Error(`PU invalide ligne ${idx + 1}`);
      const vat = l.vatRate != null && l.vatRate !== '' ? Number(l.vatRate) : null;
      if (vat != null && (isNaN(vat) || vat < 0)) throw new Error(`TVA invalide ligne ${idx + 1}`);
      return {
        label: l.label || 'Immobilisation',
        assetCategoryId: l.assetCategoryId,
        quantity: qty.toString(),
        unitPrice: price.toString(),
        vatRate: vat != null ? vat.toFixed(2) : undefined,
      };
    });
    const po = await prisma.$transaction(async (tx) => {
      const number = await nextSequence(tx, 'ASSET_PO', 'APO-');
      return tx.assetPurchaseOrder.create({
        data: {
          number,
          supplierId,
          expectedDate: expectedDate ? new Date(expectedDate) : undefined,
          currency,
          notes,
          lines: { create: norm },
        },
        include: { supplier: true, lines: { include: { assetCategory: true } } },
      });
    });
    return NextResponse.json(po, { status: 201 });
  } catch (e) {
    const msg = e.message || 'Erreur création BC immob.';
    const status = msg.includes('invalide') || msg.includes('manquante') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
