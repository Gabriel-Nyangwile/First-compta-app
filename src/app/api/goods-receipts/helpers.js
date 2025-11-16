import prisma from "@/lib/prisma";
import { audit } from "@/lib/audit";

const EPS = 1e-9;

export async function refreshGoodsReceiptStatus(tx, receiptId) {
  if (!receiptId) return;
  const [receipt, lines] = await Promise.all([
    tx.goodsReceipt.findUnique({
      where: { id: receiptId },
      select: {
        id: true,
        qcCompletedAt: true,
        putAwayCompletedAt: true,
        status: true,
        purchaseOrderId: true,
      },
    }),
    tx.goodsReceiptLine.findMany({
      where: { goodsReceiptId: receiptId },
      select: {
        status: true,
        qcStatus: true,
        qtyReceived: true,
        qtyPutAway: true,
      },
    }),
  ]);

  if (!receipt) return;

  if (!lines.length) {
    await tx.goodsReceipt.update({
      where: { id: receiptId },
      data: {
        status: "OPEN",
        qcCompletedAt: null,
        putAwayCompletedAt: null,
      },
    });
    return;
  }

  const anyQcPending = lines.some((line) => line.qcStatus === "PENDING");
  const anyRejected = lines.some((line) => line.status === "QC_REJECTED");
  const anyPutAwayPending = lines.some(
    (line) => line.status === "PUTAWAY_PENDING"
  );
  const allResolved = lines.every(
    (line) => line.status === "PUTAWAY_DONE" || line.status === "QC_REJECTED"
  );

  let status = "OPEN";
  if (anyQcPending || (anyRejected && !allResolved)) status = "QC_PENDING";
  else if (anyPutAwayPending) status = "PUTAWAY_PENDING";
  else if (allResolved) status = "PUTAWAY_DONE";

  const data = { status };
  if (!anyQcPending) {
    data.qcCompletedAt = receipt.qcCompletedAt ?? new Date();
  } else {
    data.qcCompletedAt = null;
  }

  if (status === "PUTAWAY_DONE" && allResolved) {
    data.putAwayCompletedAt = receipt.putAwayCompletedAt ?? new Date();
  } else if (status !== "PUTAWAY_DONE") {
    data.putAwayCompletedAt = null;
  }

  await tx.goodsReceipt.update({ where: { id: receiptId }, data });
}

export async function recalcPurchaseOrderStatus(
  tx,
  purchaseOrderId,
  note = "Mise à jour quantités réception"
) {
  if (!purchaseOrderId) return;
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      lines: true,
      goodsReceipts: {
        select: {
          id: true,
          lines: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!po) return;

  const lines = po.lines || [];
  const goodsReceipts = po.goodsReceipts || [];
  const hasLines = lines.length > 0;
  const allReceived =
    hasLines &&
    lines.every((line) => {
      const received =
        Number(line.receivedQty || 0) - Number(line.returnedQty || 0);
      return received >= Number(line.orderedQty) - EPS;
    });
  const anyReceived = lines.some((line) => {
    const received =
      Number(line.receivedQty || 0) - Number(line.returnedQty || 0);
    return received > EPS;
  });
  const allBilled =
    hasLines &&
    lines.every(
      (line) => Number(line.billedQty) >= Number(line.orderedQty) - EPS
    );

  const terminalLineStatuses = new Set(["PUTAWAY_DONE", "QC_REJECTED"]);
  const hasOutstandingStaging = goodsReceipts.some((gr) =>
    gr.lines?.some((line) => !terminalLineStatuses.has(line.status))
  );

  let targetStatus = po.status;
  if (hasOutstandingStaging) targetStatus = "STAGED";
  else if (allReceived) targetStatus = "RECEIVED";
  else if (anyReceived) targetStatus = "PARTIAL";
  else if (po.status !== "DRAFT") targetStatus = "APPROVED";

  let currentStatus = po.status;
  if (targetStatus !== currentStatus) {
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: targetStatus },
    });
    await tx.purchaseOrderStatusLog.create({
      data: {
        purchaseOrderId: po.id,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        note,
      },
    });
    await audit(tx, {
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: "STATUS_CHANGE",
      data: { from: currentStatus, to: targetStatus },
    });
    currentStatus = targetStatus;
  }

  const autoCloseOnReceived = process.env.PO_AUTO_CLOSE_ON_RECEIVED === "true";
  const shouldClose =
    currentStatus === "RECEIVED" && (autoCloseOnReceived || allBilled);
  if (shouldClose && currentStatus !== "CLOSED") {
    const closeNote = allBilled
      ? "Clôture auto (réception + facturation)"
      : "Clôture auto (réception complète)";
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "CLOSED" },
    });
    await tx.purchaseOrderStatusLog.create({
      data: {
        purchaseOrderId: po.id,
        oldStatus: currentStatus,
        newStatus: "CLOSED",
        note: closeNote,
      },
    });
    await audit(tx, {
      entityType: "PurchaseOrder",
      entityId: po.id,
      action: "AUTO_CLOSE",
      data: { from: currentStatus, to: "CLOSED" },
    });
  }
}

export async function ensureStorageLocation(tx, code) {
  if (!code) return null;
  const client = tx || prisma;
  const existing = await client.storageLocation.findUnique({ where: { code } });
  if (existing) return existing;
  return client.storageLocation.create({
    data: {
      code,
      label: code,
    },
  });
}
