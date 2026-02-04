import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

// GET /api/purchase-orders/missing-invoices
// Returns purchase orders fully received (or closed) that do not have any supplier invoice recorded yet.
export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        companyId,
        status: { in: ["RECEIVED", "CLOSED"] },
        incomingInvoices: { none: {} },
      },
      orderBy: { issueDate: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        lines: { select: { orderedQty: true, receivedQty: true } },
      },
    });

    return NextResponse.json({ purchaseOrders });
  } catch (error) {
    console.error("GET /purchase-orders/missing-invoices error", error);
    return NextResponse.json(
      { error: "Erreur récupération BC sans facture." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
