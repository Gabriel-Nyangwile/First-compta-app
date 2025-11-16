import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/stock-ledger?productId=&dateFrom=&dateTo=&limit=100
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const limit = Math.min(Number(searchParams.get("limit")||100), 500);
  const all = searchParams.get("all");

  if (all === "1") {
    // Export global : tous les produits avec stock final et coût moyen
    try {
      const products = await prisma.product.findMany({
        select: {
          sku: true,
          name: true,
          inventory: {
            select: {
              qtyOnHand: true,
              avgCost: true
            }
          }
        }
      });
      const result = products.map(prod => ({
        sku: prod.sku,
        name: prod.name,
        stockFinal: Number(prod.inventory?.qtyOnHand ?? 0),
        avgCostFinal: Number(prod.inventory?.avgCost ?? 0)
      }));
      return NextResponse.json({ products: result });
    } catch (e) {
      console.error("GET /stock-ledger?all=1 error", e);
      return NextResponse.json({ error: "Erreur export global stock." }, { status: 500 });
    }
  }

  // ...existing code for productId and movements...
  const filters = {};
  if (productId) filters.productId = productId;
  if (dateFrom || dateTo) {
    filters.date = {};
    if (dateFrom) filters.date.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filters.date.lte = end;
    }
  }
  try {
    const movements = await prisma.stockMovement.findMany({
      where: filters,
      orderBy: { date: "asc" },
      take: limit,
      include: { product: { select: { id: true, sku: true, name: true } } },
    });
    // Calcul soldes début/fin et coût moyen
    let openingQty = null, closingQty = null, openingCost = null, closingCost = null;
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { inventory: { select: { qtyOnHand: true, avgCost: true } } }
      });
      openingQty = product?.inventory?.qtyOnHand ?? null;
      openingCost = product?.inventory?.avgCost ?? null;
      // Simule le solde final en appliquant les mouvements
      let qty = Number(openingQty ?? 0);
      let cost = Number(openingCost ?? 0);
      for (const mvt of movements) {
        qty += Number(mvt.qty);
        // Valorisation simplifiée (CUMP)
        if (mvt.unitCost != null && mvt.qty > 0) {
          cost = ((qty - mvt.qty) * cost + mvt.qty * Number(mvt.unitCost)) / qty;
        }
      }
      closingQty = qty;
      closingCost = cost;
    }
    return NextResponse.json({
      product: movements[0]?.product || null,
      movements,
      openingQty,
      openingCost,
      closingQty,
      closingCost,
      stockFinal: closingQty,
      avgCostFinal: closingCost,
    });
  } catch (e) {
    console.error("GET /stock-ledger error", e);
    return NextResponse.json({ error: "Erreur récupération ledger stock." }, { status: 500 });
  }
}
