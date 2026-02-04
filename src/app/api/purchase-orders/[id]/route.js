import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

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

// GET /api/purchase-orders/[id]
// Retourne les détails complets du bon de commande :
// - supplier
// - lines (avec remainingQty)
// - goodsReceipts (et leurs lines)
// - summary (statistiques de réception)
export async function GET(_request, context) {
  try {
    const companyId = requireCompanyId(_request);
    const params = await resolveParams(context);
    const id = params.id;
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );
    }
    const po = await prisma.purchaseOrder.findUnique({
      where: { id, companyId },
      include: {
        supplier: true,
        lines: { include: { product: true } },
        goodsReceipts: {
          include: {
            lines: { include: { product: true, purchaseOrderLine: true } },
          },
        },
        statusLogs: { orderBy: { changedAt: "asc" } },
      },
    });
    if (!po)
      return NextResponse.json(
        { error: "Bon de commande introuvable." },
        { status: 404 }
      );

    const lines = po.lines.map((l) => {
      const ordered = toNumber(l.orderedQty);
      const receivedRaw = toNumber(l.receivedQty);
      const returned = toNumber(l.returnedQty);
      const billed = toNumber(l.billedQty);
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
        billedQty: billed,
        remainingQty: remaining,
      };
    });

    const fullyReceivedLines = lines.filter(
      (l) => l.remainingQty <= 1e-9
    ).length;
    const anyReceived = lines.some((l) => l.receivedQty > 0);
    const allReceived =
      fullyReceivedLines === lines.length && lines.length > 0;

    const summary = {
      totalLines: lines.length,
      fullyReceivedLines,
      partiallyReceivedLines: lines.filter(
        (l) => l.receivedQty > 0 && l.remainingQty > 1e-9
      ).length,
      notReceivedLines: lines.filter((l) => l.receivedQty <= 1e-9).length,
      anyReceived,
      allReceived,
      totalOrderedQty: lines.reduce((sum, l) => sum + l.orderedQty, 0),
      totalReceivedQty: lines.reduce((sum, l) => sum + l.receivedQty, 0),
      totalReturnedQty: lines.reduce((sum, l) => sum + l.returnedQty, 0),
    };

    return NextResponse.json({
      id: po.id,
      number: po.number,
      status: po.status,
      issueDate: po.issueDate,
      expectedDate: po.expectedDate,
      currency: po.currency,
      notes: po.notes,
      supplier: po.supplier,
      lines,
      goodsReceipts: po.goodsReceipts,
      statusLogs: po.statusLogs || [],
      summary,
    });
  } catch (e) {
    console.error("GET /purchase-orders/[id] error", e);
    return NextResponse.json(
      { error: "Erreur récupération bon de commande." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
