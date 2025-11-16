import { NextResponse } from "next/server";
import {
  approvePurchaseOrder,
  PurchaseOrderApprovalError,
} from "@/lib/purchaseOrders";

// POST /api/purchase-orders/[id]/approve
// Approve a purchase order currently in DRAFT status.
export async function POST(request, rawContext) {
  try {
    const context = await Promise.resolve(rawContext);
    const params = context?.params ? await context.params : undefined;
    const id = params?.id;
    if (!id) {
      console.warn("Approve PO called without id param");
      return NextResponse.json(
        { error: "Paramètre id manquant dans l'URL." },
        { status: 400 }
      );
    }

    const updated = await approvePurchaseOrder(id);

    const acceptHeader = request.headers.get("accept") || "";
    const expectsHtml = acceptHeader.includes("text/html");
    if (expectsHtml) {
      const redirectUrl = new URL(`/purchase-orders/${id}`, request.url);
      return NextResponse.redirect(redirectUrl, 303);
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    if (e instanceof PurchaseOrderApprovalError) {
      return NextResponse.json(
        { error: e.message },
        { status: e.status ?? 500 }
      );
    }
    console.error("Approve PO error", e);
    return NextResponse.json(
      { error: "Erreur approbation PO." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; // ensure no static optimization interferes
