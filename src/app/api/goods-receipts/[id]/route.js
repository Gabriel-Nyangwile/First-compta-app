import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { moveStagedToAvailable, removeStaged } from "@/lib/inventory";
import { finalizeBatchToJournal } from "@/lib/journal";
import { requireCompanyId } from "@/lib/tenant";
import {
  refreshGoodsReceiptStatus,
  recalcPurchaseOrderStatus,
  ensureStorageLocation,
} from "../helpers";

const EPS = 1e-9;

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

async function resolveParams(context) {
  const ctx = await Promise.resolve(context);
  if (!ctx) return {};
  if (ctx.params) return await Promise.resolve(ctx.params);
  return ctx;
}

function buildSummary(lines = []) {
  const summary = {
    totalLines: lines.length,
    qcPending: 0,
    qcRejected: 0,
    putAwayPending: 0,
    putAwayDone: 0,
    totalReceivedQty: 0,
    totalPutAwayQty: 0,
    outstandingQty: 0,
    totalReturnedQty: 0,
    returnableQty: 0,
  };
  for (const line of lines) {
    const received = Number(line.qtyReceived || 0);
    const putAway = Number(line.qtyPutAway || 0);
    summary.totalReceivedQty += received;
    summary.totalPutAwayQty += putAway;
    summary.totalReturnedQty += Number(line.returnedQty || 0);
    summary.returnableQty += Number(line.availableForReturn || 0);
    if (line.qcStatus === "PENDING") summary.qcPending += 1;
    if (line.qcStatus === "REJECTED") summary.qcRejected += 1;
    if (line.status === "PUTAWAY_PENDING") summary.putAwayPending += 1;
    if (line.status === "PUTAWAY_DONE") summary.putAwayDone += 1;
    const outstanding = Math.max(0, received - putAway);
    if (line.status !== "QC_REJECTED") summary.outstandingQty += outstanding;
  }
  return summary;
}

export async function GET(_request, rawContext) {
  try {
    const companyId = requireCompanyId(_request);
    const params = await resolveParams(rawContext);
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );
    }
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id, companyId },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true, status: true } },
        returnOrders: {
          select: {
            id: true,
            number: true,
            status: true,
            createdAt: true,
            issuedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        lines: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true },
            },
            purchaseOrderLine: {
              select: {
                id: true,
                orderedQty: true,
                receivedQty: true,
                billedQty: true,
                returnedQty: true,
                product: { select: { id: true, sku: true, name: true } },
              },
            },
            returnOrderLines: {
              include: {
                returnOrder: {
                  select: { id: true, number: true, status: true },
                },
              },
            },
          },
        },
      },
    });
    if (!receipt)
      return NextResponse.json(
        { error: "Réception introuvable." },
        { status: 404 }
      );

    const normalizedLines = (receipt.lines || []).map((line) => {
      const qtyReceived = toNumber(line.qtyReceived);
      const qtyPutAway = toNumber(line.qtyPutAway);
      const purchaseOrderLine = line.purchaseOrderLine
        ? {
            ...line.purchaseOrderLine,
            orderedQty: toNumber(line.purchaseOrderLine.orderedQty),
            receivedQty: toNumber(line.purchaseOrderLine.receivedQty),
            billedQty: toNumber(line.purchaseOrderLine.billedQty),
            returnedQty: toNumber(line.purchaseOrderLine.returnedQty),
          }
        : null;
      const returnOrderLines = (line.returnOrderLines || []).map((rol) => ({
        ...rol,
        quantity: toNumber(rol.quantity),
        createdAt: rol.createdAt?.toISOString?.() ?? rol.createdAt,
        returnOrder: rol.returnOrder || null,
      }));
      const alreadyReturned = returnOrderLines
        .filter((rol) => rol.returnOrder?.status !== "CANCELLED")
        .reduce((sum, rol) => sum + Number(rol.quantity || 0), 0);
      const availableForReturn = Math.max(0, qtyPutAway - alreadyReturned);

      return {
        ...line,
        qtyReceived,
        qtyPutAway,
        purchaseOrderLine,
        returnOrderLines,
        returnedQty: alreadyReturned,
        availableForReturn,
      };
    });

    const normalizedReturnOrders = (receipt.returnOrders || []).map(
      (order) => ({
        ...order,
        createdAt: order.createdAt?.toISOString?.() ?? order.createdAt,
        issuedAt: order.issuedAt?.toISOString?.() ?? order.issuedAt,
      })
    );

    return NextResponse.json({
      ...receipt,
      lines: normalizedLines,
      returnOrders: normalizedReturnOrders,
      summary: buildSummary(normalizedLines),
    });
  } catch (error) {
    console.error("GET /goods-receipts/[id] error", error);
    return NextResponse.json(
      { error: "Erreur récupération réception." },
      { status: 500 }
    );
  }
}

export async function PUT(request, rawContext) {
  const companyId = requireCompanyId(request);
  const params = await resolveParams(rawContext);
  const id = params?.id;
  if (!id) {
    return NextResponse.json(
      { error: "Paramètre id manquant." },
      { status: 400 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const { action } = body || {};
  if (!action)
    return NextResponse.json({ error: "action requis" }, { status: 400 });

  try {
    if (action === "QC_ACCEPT") {
      const { lineId, qcNote } = body;
      if (!lineId)
        return NextResponse.json({ error: "lineId requis" }, { status: 400 });
      await prisma.$transaction(async (tx) => {
        const line = await tx.goodsReceiptLine.findUnique({
          where: { id: lineId, companyId },
          include: { goodsReceipt: true },
        });
        if (!line || line.goodsReceiptId !== id) {
          throw new Error("Ligne introuvable");
        }
        const remaining =
          Number(line.qtyReceived) - Number(line.qtyPutAway || 0);
        const nextStatus =
          remaining <= EPS ? "PUTAWAY_DONE" : "PUTAWAY_PENDING";
        await tx.goodsReceiptLine.update({
          where: { id: lineId },
          data: {
            qcStatus: "ACCEPTED",
            status: nextStatus,
            qcCheckedAt: new Date(),
            qcNote: qcNote || null,
          },
        });
        await refreshGoodsReceiptStatus(tx, id, companyId);
        if (line.goodsReceipt.purchaseOrderId) {
          await recalcPurchaseOrderStatus(
            tx,
            line.goodsReceipt.purchaseOrderId,
            "Mise à jour QC réception",
            companyId
          );
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "QC_REJECT") {
      const { lineId, qty, qcNote } = body;
      if (!lineId)
        return NextResponse.json({ error: "lineId requis" }, { status: 400 });
      const qtyNum = qty != null ? Number(qty) : null;
      if (qty != null && (Number.isNaN(qtyNum) || qtyNum < 0)) {
        return NextResponse.json({ error: "qty invalide" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const line = await tx.goodsReceiptLine.findUnique({
          where: { id: lineId, companyId },
          include: { goodsReceipt: true },
        });
        if (!line || line.goodsReceiptId !== id)
          throw new Error("Ligne introuvable");
        const stagedRemaining =
          Number(line.qtyReceived) - Number(line.qtyPutAway || 0);
        const rejectQty = qtyNum != null ? qtyNum : stagedRemaining;
        if (rejectQty < 0 || rejectQty > stagedRemaining + EPS) {
          throw new Error("Quantité rejetée dépasse le restant en contrôle");
        }
        if (rejectQty > 0) {
          await removeStaged(tx, {
            productId: line.productId,
            qty: rejectQty,
            companyId,
          });
          await tx.stockMovement.create({
            data: {
              companyId,
              productId: line.productId,
              movementType: "ADJUST",
              stage: "STAGED",
              quantity: (-rejectQty).toFixed(3),
              unitCost: line.unitCost.toString(),
              totalCost: (-(rejectQty * Number(line.unitCost))).toFixed(2),
              goodsReceiptLineId: lineId,
            },
          });
        }
        await tx.goodsReceiptLine.update({
          where: { id: lineId },
          data: {
            qcStatus: "REJECTED",
            status: "QC_REJECTED",
            qcCheckedAt: new Date(),
            qcNote: qcNote || null,
          },
        });
        if (line.purchaseOrderLineId) {
          const pol = await tx.purchaseOrderLine.findUnique({
            where: { id: line.purchaseOrderLineId, companyId },
          });
          if (pol) {
            const newReceived = Math.max(
              0,
              Number(pol.receivedQty) - rejectQty
            );
            await tx.purchaseOrderLine.update({
              where: { id: pol.id, companyId },
              data: { receivedQty: newReceived.toFixed(3) },
            });
          }
        }
        await refreshGoodsReceiptStatus(tx, id, companyId);
        if (line.goodsReceipt.purchaseOrderId) {
          await recalcPurchaseOrderStatus(
            tx,
            line.goodsReceipt.purchaseOrderId,
            "Mise à jour QC réception",
            companyId
          );
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "PUTAWAY") {
      const { lineId, qty, unitCost, storageLocationId, storageLocationCode } =
        body;
      if (!lineId)
        return NextResponse.json({ error: "lineId requis" }, { status: 400 });
      const qtyNum = Number(qty);
      if (Number.isNaN(qtyNum) || qtyNum <= 0) {
        return NextResponse.json({ error: "qty invalide" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const line = await tx.goodsReceiptLine.findUnique({
          where: { id: lineId, companyId },
          include: {
            goodsReceipt: {
              select: {
                id: true,
                number: true,
                receiptDate: true,
                supplierId: true,
                purchaseOrderId: true,
              },
            },
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                inventoryAccountId: true,
                stockVariationAccountId: true,
              },
            },
          },
        });
        if (!line || line.goodsReceiptId !== id)
          throw new Error("Ligne introuvable");
        const remaining =
          Number(line.qtyReceived) - Number(line.qtyPutAway || 0);
        if (qtyNum > remaining + EPS) {
          throw new Error("Quantité dépasse le restant");
        }
        const cost =
          unitCost != null ? Number(unitCost) : Number(line.unitCost);
        if (Number.isNaN(cost) || cost < 0) {
          throw new Error("unitCost invalide");
        }
        await moveStagedToAvailable(tx, {
          productId: line.productId,
          qty: qtyNum,
          unitCost: cost,
          companyId,
        });
        const newPutAway = Number(line.qtyPutAway || 0) + qtyNum;
        const status =
          newPutAway >= Number(line.qtyReceived) - EPS
            ? "PUTAWAY_DONE"
            : "PUTAWAY_PENDING";
        let storageLocation = null;
        if (!storageLocationId && storageLocationCode) {
          storageLocation = await ensureStorageLocation(
            tx,
            storageLocationCode,
            companyId
          );
        }
        await tx.goodsReceiptLine.update({
          where: { id: lineId },
          data: {
            qtyPutAway: newPutAway.toFixed(3),
            status,
            unitCost: cost.toFixed(4),
            putAwayAt: new Date(),
            storageLocationId: storageLocationId || storageLocation?.id || null,
          },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: line.productId,
            movementType: "IN",
            stage: "AVAILABLE",
            quantity: qtyNum.toFixed(3),
            unitCost: cost.toFixed(4),
            totalCost: (qtyNum * cost).toFixed(2),
            goodsReceiptLineId: lineId,
          },
        });

        const product = line.product;
        if (!product.inventoryAccountId || !product.stockVariationAccountId) {
          throw new Error(
            "Comptes inventaire/variation manquants pour ce produit. Configurez-les avant mise en stock."
          );
        }

        const amount = Number((qtyNum * cost).toFixed(2));
        if (amount > 0) {
          const postingDate = line.goodsReceipt?.receiptDate || new Date();
          const descriptionParts = [
            "Mise en stock",
            line.goodsReceipt?.number || "",
          ];
          if (product.sku) descriptionParts.push(`SKU ${product.sku}`);
          const description = descriptionParts.filter(Boolean).join(" ");

          const transactions = [];
            const inventoryTx = await tx.transaction.create({
              data: {
                companyId,
                date: postingDate,
              nature: "inventory",
              description,
              amount: amount.toFixed(2),
              direction: "DEBIT",
              kind: "INVENTORY_ASSET",
              accountId: product.inventoryAccountId,
              supplierId: line.goodsReceipt?.supplierId || null,
            },
          });
          transactions.push(inventoryTx);

            const variationTx = await tx.transaction.create({
              data: {
                companyId,
                date: postingDate,
              nature: "inventory",
              description,
              amount: amount.toFixed(2),
              direction: "CREDIT",
              kind: "STOCK_VARIATION",
              accountId: product.stockVariationAccountId,
              supplierId: line.goodsReceipt?.supplierId || null,
            },
          });
          transactions.push(variationTx);

          await finalizeBatchToJournal(tx, {
            sourceType: "GOODS_RECEIPT",
            sourceId: line.goodsReceipt?.id,
            date: postingDate,
            description,
            transactions,
          });
        }
        await refreshGoodsReceiptStatus(tx, id, companyId);
        if (line.goodsReceipt.purchaseOrderId) {
          await recalcPurchaseOrderStatus(
            tx,
            line.goodsReceipt.purchaseOrderId,
            "Mise à jour put-away réception",
            companyId
          );
        }
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PUT /goods-receipts/[id] error", error);
    return NextResponse.json(
      { error: error.message || "Erreur traitement réception" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
