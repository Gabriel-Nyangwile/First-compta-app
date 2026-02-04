import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

async function resolveParams(maybeCtx) {
  let ctx = maybeCtx;
  if (ctx && typeof ctx.then === "function") ctx = await ctx;
  let p = ctx?.params ?? ctx;
  if (p && typeof p.then === "function") p = await p;
  return p || {};
}

// POST /api/purchase-orders/[id]/approve
// Approve a purchase order currently in DRAFT status.
export async function POST(request, rawContext) {
  try {
    const companyId = requireCompanyId(request);
    const params = await resolveParams(rawContext);
    const id = params?.id;
    if (!id) {
      console.warn("Approve PO called without id param");
      return NextResponse.json(
        { error: "Paramètre id manquant dans l'URL." },
        { status: 400 }
      );
    }
    // Inline approval to avoid any module resolution issues
    const po = await prisma.purchaseOrder.findUnique({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!po) {
      return NextResponse.json(
        { error: "Bon de commande introuvable." },
        { status: 404 }
      );
    }
    if (po.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Impossible d'approuver: statut actuel ${po.status}.` },
        { status: 409 }
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.purchaseOrder.update({
        where: { id, companyId },
        data: { status: "APPROVED" },
      });
      await tx.purchaseOrderStatusLog.create({
        data: {
          companyId,
          purchaseOrderId: id,
          oldStatus: po.status,
          newStatus: "APPROVED",
          note: "Approbation",
        },
      });
      try {
        const mod = await import("@/lib/audit");
        await mod.audit(tx, {
          entityType: "PurchaseOrder",
          entityId: id,
          action: "APPROVE",
          data: { from: po.status, to: "APPROVED" },
        });
      } catch (_) {
        // ignore audit failures in API path
      }
      return next;
    });

    const acceptHeader = request.headers.get("accept") || "";
    const expectsHtml = acceptHeader.includes("text/html");
    if (expectsHtml) {
      const redirectUrl = new URL(`/purchase-orders/${id}`, request.url);
      return NextResponse.redirect(redirectUrl, 303);
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("Approve PO error", e);
    return NextResponse.json(
      { error: `Erreur approbation PO: ${e?.message || 'unknown error'}` },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; // ensure no static optimization interferes
