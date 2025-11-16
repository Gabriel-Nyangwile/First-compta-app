import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/inventory/[productId]
// NOTE (Next.js 15): context.params can be a Promise and must be awaited before property access.
export async function GET(_request, context) {
  try {
    const { productId } = await context.params;
    if (!productId || typeof productId !== "string" || productId.length < 10) {
      return NextResponse.json(
        { error: "Paramètre productId manquant ou invalide." },
        { status: 400 }
      );
    }
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product)
      return NextResponse.json(
        { error: "Produit introuvable." },
        { status: 404 }
      );
    let inv = null;
    try {
      inv = await prisma.productInventory.findUnique({ where: { productId } });
    } catch {}
    // Si pas d'inventaire, retourner qtyOnHand: '0', avgCost: null
    return NextResponse.json({
      product,
      inventory: inv || { qtyOnHand: "0", avgCost: null },
    });
  } catch (e) {
    console.error("GET /inventory/[productId] error", e);
    // If the error is about accessing params synchronously, surface a clearer message.
    if (e?.message?.includes("params")) {
      return NextResponse.json(
        {
          error: "Accès invalide à params (corrigé) – recompiler et réessayer.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Erreur récupération inventaire." },
      { status: 500 }
    );
  }
}
