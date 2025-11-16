import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

async function resolveParams(maybeCtx) {
  let ctx = maybeCtx;
  if (ctx && typeof ctx.then === "function") ctx = await ctx;
  let p = ctx?.params ?? ctx;
  if (p && typeof p.then === "function") p = await p;
  return p || {};
}

// GET /api/purchase-orders/[id]/remaining
// Retourne uniquement les lignes avec quantité restante > 0 + résumé.
export async function GET(_request, context) {
  try {
    const params = await resolveParams(context);
    const id = params.id;
    if (!id)
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    });
    if (!po)
      return NextResponse.json(
        { error: "Bon de commande introuvable." },
        { status: 404 }
      );

    const allLines = po.lines.map((l) => {
      const ordered = toNumber(l.orderedQty);
      const receivedRaw = toNumber(l.receivedQty);
      const returned = toNumber(l.returnedQty);
      const netReceived = Math.max(0, receivedRaw - returned);
      const remaining = Math.max(
        0,
        Number((ordered - netReceived).toFixed(3))
      );
      return {
        ...l,
        orderedQty: ordered,
        receivedQty: netReceived,
        receivedQtyRaw: receivedRaw,
        returnedQty: returned,
        remainingQty: remaining,
      };
    });

    const remainingLines = allLines.filter((l) => l.remainingQty > 1e-9);
    const summary = {
      totalLines: allLines.length,
      withRemaining: remainingLines.length,
      totalRemainingQty: remainingLines.reduce(
        (acc, l) => acc + l.remainingQty,
        0
      ),
      totalOrderedQty: allLines.reduce((acc, l) => acc + l.orderedQty, 0),
      totalReceivedQty: allLines.reduce((acc, l) => acc + l.receivedQty, 0),
      totalReturnedQty: allLines.reduce((acc, l) => acc + l.returnedQty, 0),
    };

    return NextResponse.json({
      purchaseOrderId: po.id,
      status: po.status,
      remainingLines,
      summary,
    });
  } catch (e) {
    console.error("GET /purchase-orders/[id]/remaining error", e);
    return NextResponse.json(
      { error: "Erreur récupération lignes restantes." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
