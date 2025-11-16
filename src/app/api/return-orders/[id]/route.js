import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const order = await prisma.returnOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        goodsReceipt: { select: { id: true, number: true } },
        createdBy: { select: { id: true, username: true, email: true } },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true },
            },
            goodsReceiptLine: {
              select: { id: true, goodsReceiptId: true, qtyPutAway: true },
            },
            purchaseOrderLine: {
              select: {
                id: true,
                orderedQty: true,
                receivedQty: true,
                returnedQty: true,
              },
            },
            stockMovements: {
              select: {
                id: true,
                quantity: true,
                unitCost: true,
                totalCost: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!order)
      return NextResponse.json(
        { error: "Retour fournisseur introuvable" },
        { status: 404 }
      );
    const normalized = {
      ...order,
      issuedAt: order.issuedAt?.toISOString?.() ?? order.issuedAt,
      sentAt: order.sentAt?.toISOString?.() ?? order.sentAt,
      closedAt: order.closedAt?.toISOString?.() ?? order.closedAt,
      createdAt: order.createdAt?.toISOString?.() ?? order.createdAt,
      updatedAt: order.updatedAt?.toISOString?.() ?? order.updatedAt,
      lines: order.lines.map((line) => ({
        ...line,
        quantity: toNumber(line.quantity),
        unitCost: toNumber(line.unitCost),
        goodsReceiptLine: line.goodsReceiptLine
          ? {
              ...line.goodsReceiptLine,
              qtyPutAway: toNumber(line.goodsReceiptLine.qtyPutAway),
            }
          : null,
        purchaseOrderLine: line.purchaseOrderLine
          ? {
              ...line.purchaseOrderLine,
              orderedQty: toNumber(line.purchaseOrderLine.orderedQty),
              receivedQty: toNumber(line.purchaseOrderLine.receivedQty),
              returnedQty: toNumber(line.purchaseOrderLine.returnedQty),
            }
          : null,
        stockMovements: line.stockMovements.map((mvt) => ({
          ...mvt,
          quantity: toNumber(mvt.quantity),
          unitCost: toNumber(mvt.unitCost),
          totalCost: toNumber(mvt.totalCost),
          createdAt: mvt.createdAt?.toISOString?.() ?? mvt.createdAt,
        })),
      })),
    };
    return NextResponse.json(normalized);
  } catch (e) {
    console.error("GET /api/return-orders/[id] error", e);
    return NextResponse.json(
      { error: "Erreur récupération retour fournisseur" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, sentAt, closedAt, notes } = body || {};

    if (!status)
      return NextResponse.json({ error: "status requis" }, { status: 400 });
    if (!["DRAFT", "SENT", "CLOSED", "CANCELLED"].includes(status)) {
      return NextResponse.json(
        { error: "Statut retour invalide" },
        { status: 400 }
      );
    }

    const order = await prisma.returnOrder.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!order)
      return NextResponse.json(
        { error: "Retour fournisseur introuvable" },
        { status: 404 }
      );

    const updated = await prisma.returnOrder.update({
      where: { id },
      data: {
        status,
        sentAt: sentAt
          ? new Date(sentAt)
          : status === "SENT"
          ? new Date()
          : null,
        closedAt: closedAt
          ? new Date(closedAt)
          : status === "CLOSED"
          ? new Date()
          : null,
        notes: notes != null ? String(notes).trim() : undefined,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        goodsReceipt: { select: { id: true, number: true } },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/return-orders/[id] error", e);
    return NextResponse.json(
      { error: e.message || "Erreur mise à jour retour fournisseur" },
      { status: 500 }
    );
  }
}
