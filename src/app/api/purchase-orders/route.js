import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

// GET /api/purchase-orders?status=&supplierId=&q=
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const supplierId = searchParams.get("supplierId");
  const q = searchParams.get("q");
  const where = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (q) where.number = { contains: q, mode: "insensitive" };
  try {
    const pos = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { supplier: true, lines: { include: { product: true, assetCategory: true } } },
    });
    const normalized = pos.map((po) => {
      const lines = (po.lines || []).map((line) => {
        const ordered = toNumber(line.orderedQty);
        const receivedRaw = toNumber(line.receivedQty);
        const returned = toNumber(line.returnedQty);
        const billed = toNumber(line.billedQty);
        const netReceived = Math.max(0, receivedRaw - returned);
        return {
          ...line,
          orderedQty: ordered,
          receivedQty: netReceived,
          receivedQtyRaw: receivedRaw,
          returnedQty: returned,
          billedQty: billed,
          unitPrice: toNumber(line.unitPrice),
        };
      });
      return {
        ...po,
        lines,
        totalOrderedQty: lines.reduce((sum, l) => sum + l.orderedQty, 0),
        totalReceivedQty: lines.reduce((sum, l) => sum + l.receivedQty, 0),
        totalReturnedQty: lines.reduce((sum, l) => sum + l.returnedQty, 0),
      };
    });
    return NextResponse.json(normalized);
  } catch (e) {
    console.error("GET /purchase-orders error", e);
    return NextResponse.json(
      { error: "Erreur récupération bons de commande." },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders
// { supplierId, expectedDate?, currency?, notes?, lines:[{ productId, orderedQty, unitPrice, vatRate?, assetCategoryId? }] }
export async function POST(request) {
  try {
    const body = await request.json();
    const { supplierId, expectedDate, currency = "EUR", notes, lines } = body;
    if (!supplierId)
      return NextResponse.json({ error: "supplierId requis." }, { status: 400 });
    if (!Array.isArray(lines) || !lines.length)
      return NextResponse.json({ error: "lines requises." }, { status: 400 });
    // Basic validation & normalization
    const normLines = lines.map((l, idx) => {
      const productId = l.productId;
      const orderedQty = Number(l.orderedQty);
      const unitPrice = Number(l.unitPrice);
      if (
        !productId ||
        isNaN(orderedQty) ||
        orderedQty <= 0 ||
        isNaN(unitPrice) ||
        unitPrice < 0
      ) {
        throw new Error(`Ligne ${idx + 1} invalide.`);
      }
      const vatRate =
        l.vatRate != null && l.vatRate !== "" ? Number(l.vatRate) : null;
      if (vatRate != null && (isNaN(vatRate) || vatRate < 0))
        throw new Error(`Taux TVA invalide ligne ${idx + 1}`);
      return {
        productId,
        orderedQty: orderedQty.toString(),
        unitPrice: unitPrice.toString(),
        vatRate: vatRate != null ? vatRate.toFixed(2) : undefined,
        assetCategoryId: l.assetCategoryId || undefined,
      };
    });

    const poId = await prisma.$transaction(async (tx) => {
      const number = await nextSequence(tx, "PO", "PO-");
      const po = await tx.purchaseOrder.create({
        data: {
          number,
          supplierId,
          expectedDate: expectedDate ? new Date(expectedDate) : undefined,
          currency,
          notes,
          lines: { create: normLines },
        },
      });
      return po.id;
    });
    const full = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true, lines: { include: { product: true } } },
    });
    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error("POST /purchase-orders error", e);
    if (e.message?.startsWith("Ligne") || e.message?.includes("invalide")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Erreur création bon de commande." },
      { status: 500 }
    );
  }
}
