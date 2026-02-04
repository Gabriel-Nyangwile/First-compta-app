import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

// GET /api/stock-alerts?min=5
export async function GET(request) {
  const companyId = requireCompanyId(request);
  const { searchParams } = new URL(request.url);
  const min = Number(searchParams.get("min") ?? "5");
  // Optionally support per-product minStockAlert in future
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        minStockAlert: true,
        isActive: true,
        inventory: {
          select: { qtyOnHand: true, avgCost: true },
        },
      },
      where: { isActive: true, companyId },
    });
    const result = products.map((p) => {
      const threshold = p.minStockAlert != null ? Number(p.minStockAlert) : min;
      const qty = Number(p.inventory?.qtyOnHand ?? 0);
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        qtyOnHand: qty,
        avgCost: Number(p.inventory?.avgCost ?? 0),
        minStockAlert: threshold,
        alert: qty < threshold,
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /stock-alerts error", e);
    return NextResponse.json({ error: "Erreur récupération alertes stock." }, { status: 500 });
  }
}
