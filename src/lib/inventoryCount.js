import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { applyAdjustMovement } from "@/lib/inventory";
import { finalizeBatchToJournal } from "@/lib/journal";
import { sendInventoryCountNotification } from "@/lib/notifications";

const COUNT_INCLUDE = {
  createdBy: { select: { id: true, username: true, email: true } },
  lines: {
    include: {
      product: { select: { id: true, sku: true, name: true } },
      movement: {
        select: {
          id: true,
          date: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
        },
      },
      journalEntry: {
        select: { id: true, number: true, date: true },
      },
    },
    orderBy: { product: { sku: "asc" } },
  },
};

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  if (typeof value === "string" && value.trim() === "") return 0;
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function toFixedString(value, digits) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return null;
  return num.toFixed(digits);
}

function normalizeLine(line) {
  return {
    id: line.id,
    inventoryCountId: line.inventoryCountId,
    status: line.status,
    product: line.product,
    snapshotQty: toNumber(line.snapshotQty),
    snapshotAvgCost:
      line.snapshotAvgCost == null ? null : toNumber(line.snapshotAvgCost),
    countedQty:
      line.countedQty == null ? null : toNumber(line.countedQty),
    deltaQty: line.deltaQty == null ? null : toNumber(line.deltaQty),
    deltaValue:
      line.deltaValue == null ? null : toNumber(line.deltaValue),
    movement: line.movement
      ? {
          ...line.movement,
          quantity: toNumber(line.movement.quantity),
          unitCost:
            line.movement.unitCost == null
              ? null
              : toNumber(line.movement.unitCost),
          totalCost:
            line.movement.totalCost == null
              ? null
              : toNumber(line.movement.totalCost),
        }
      : null,
    journalEntry: line.journalEntry,
    createdAt: line.createdAt?.toISOString?.() ?? line.createdAt,
    updatedAt: line.updatedAt?.toISOString?.() ?? line.updatedAt,
  };
}

export function normalizeInventoryCount(count) {
  if (!count) return null;
  const lines = (count.lines || []).map(normalizeLine);
  let totalDeltaQty = 0;
  let totalDeltaValue = 0;
  let countedLines = 0;
  let postedLines = 0;
  let totalLines = lines.length;

  for (const line of lines) {
    if (line.countedQty != null) countedLines += 1;
    if (line.status === "POSTED") postedLines += 1;
    const dq =
      line.deltaQty != null
        ? line.deltaQty
        : line.countedQty != null
        ? line.countedQty - line.snapshotQty
        : 0;
    totalDeltaQty += dq || 0;
    totalDeltaValue += line.deltaValue != null ? line.deltaValue : 0;
  }

  const pendingLines = totalLines - countedLines;

  return {
    id: count.id,
    number: count.number,
    status: count.status,
    countedAt: count.countedAt?.toISOString?.() ?? count.countedAt,
    postedAt: count.postedAt?.toISOString?.() ?? count.postedAt,
    notes: count.notes,
    createdBy: count.createdBy || null,
    createdAt: count.createdAt?.toISOString?.() ?? count.createdAt,
    updatedAt: count.updatedAt?.toISOString?.() ?? count.updatedAt,
    summary: {
      totalLines,
      countedLines,
      pendingLines,
      postedLines,
      deltaQty: Number(totalDeltaQty.toFixed(3)),
      deltaValue: Number(totalDeltaValue.toFixed(2)),
    },
    lines,
  };
}

export async function listInventoryCounts({ status } = {}) {
  const where = {};
  if (status) where.status = status;
  const counts = await prisma.inventoryCount.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: COUNT_INCLUDE,
  });
  return counts.map(normalizeInventoryCount);
}

async function nextInventoryCountNumber(tx) {
  return nextSequence(tx, "INVENTORY_COUNT", "IC-");
}

export async function createInventoryCount({
  productIds = null,
  countedAt = null,
  notes = null,
  createdById = null,
} = {}) {
  return prisma.$transaction(async (tx) => {
    const number = await nextInventoryCountNumber(tx);
    const productWhere = productIds?.length
      ? { id: { in: productIds } }
      : { isActive: true };

    const products = await tx.product.findMany({
      where: productWhere,
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        inventory: {
          select: { qtyOnHand: true, avgCost: true },
        },
      },
    });

    if (!products.length) {
      throw new Error("Aucun produit correspondant pour l'inventaire.");
    }

    const dataLines = products.map((product) => {
      const snapshotQty = product.inventory?.qtyOnHand ?? "0";
      const snapshotAvgCost = product.inventory?.avgCost ?? null;
      return {
        productId: product.id,
        snapshotQty,
        snapshotAvgCost,
      };
    });

    const created = await tx.inventoryCount.create({
      data: {
        number,
        status: "DRAFT",
        countedAt: countedAt ? new Date(countedAt) : null,
        notes: notes ? String(notes).trim() : null,
        createdById: createdById || null,
        lines: {
          create: dataLines,
        },
      },
      include: COUNT_INCLUDE,
    });

    return normalizeInventoryCount(created);
  });
}

export async function getInventoryCount(id) {
  const count = await prisma.inventoryCount.findUnique({
    where: { id },
    include: COUNT_INCLUDE,
  });
  if (!count) throw new Error("INVENTORY_COUNT_NOT_FOUND");
  return normalizeInventoryCount(count);
}

function assertEditable(count) {
  if (!["DRAFT", "COMPLETED"].includes(count.status)) {
    throw new Error(
      "Impossible de modifier un inventaire déjà publié ou annulé."
    );
  }
}

export async function recordInventoryCountLine({
  inventoryCountId,
  lineId,
  countedQty,
}) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findUnique({
      where: { id: inventoryCountId },
      include: { status: true },
    });
    if (!count) throw new Error("INVENTORY_COUNT_NOT_FOUND");
    assertEditable(count);

    const line = await tx.inventoryCountLine.findUnique({
      where: { id: lineId },
      include: { inventoryCount: { select: { status: true } } },
    });
    if (!line || line.inventoryCountId !== inventoryCountId) {
      throw new Error("Ligne d'inventaire introuvable.");
    }
    assertEditable(line.inventoryCount);

    const qtyValue = countedQty == null ? null : Number(countedQty);
    if (qtyValue != null && !Number.isFinite(qtyValue)) {
      throw new Error("Quantité inventoriée invalide.");
    }

    const updated = await tx.inventoryCountLine.update({
      where: { id: lineId },
      data: {
        countedQty:
          qtyValue == null ? null : toFixedString(qtyValue, 3),
        status: qtyValue == null ? "PENDING" : "COUNTED",
      },
      include: COUNT_INCLUDE.lines.include,
    });

    const refreshed = await tx.inventoryCount.findUnique({
      where: { id: inventoryCountId },
      include: COUNT_INCLUDE,
    });
    return normalizeInventoryCount(refreshed);
  });
}

export async function completeInventoryCount(id) {
  let normalized = null;
  await prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!count) throw new Error("INVENTORY_COUNT_NOT_FOUND");
    assertEditable(count);
    const missing = count.lines.some((line) => line.countedQty == null);
    if (missing) {
      throw new Error(
        "Toutes les lignes doivent être comptées avant validation."
      );
    }
    await tx.inventoryCount.update({
      where: { id },
      data: { status: "COMPLETED" },
    });
    const refreshed = await tx.inventoryCount.findUnique({
      where: { id },
      include: COUNT_INCLUDE,
    });
    normalized = normalizeInventoryCount(refreshed);
  });
  if (normalized) {
    try {
      await sendInventoryCountNotification(normalized, "COMPLETED");
    } catch (error) {
      console.warn("Notification inventaire COMPLETED échouée", error);
    }
  }
  return normalized;
}

export async function cancelInventoryCount(id) {
  const updated = await prisma.inventoryCount.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: COUNT_INCLUDE,
  });
  return normalizeInventoryCount(updated);
}

function buildAdjustmentDescription(count, line) {
  const sku = line.product?.sku || "Produit";
  return `Écart inventaire ${count.number} - ${sku}`;
}

async function createAdjustmentJournal({
  tx,
  count,
  line,
  inventoryAccountId,
  variationAccountId,
  deltaValue,
  deltaDate,
  description,
}) {
  const amount = Math.abs(deltaValue);
  if (amount < 1e-6) return null;
  const amountStr = amount.toFixed(2);

  const debitDirection = deltaValue >= 0 ? "DEBIT" : "DEBIT";
  const creditDirection = deltaValue >= 0 ? "CREDIT" : "CREDIT";

  const assetTransaction = await tx.transaction.create({
    data: {
      nature: "adjustment",
      description,
      amount: amountStr,
      direction: deltaValue >= 0 ? "DEBIT" : "CREDIT",
      kind: "INVENTORY_ASSET",
      accountId: inventoryAccountId,
      date: deltaDate,
    },
  });

  const variationTransaction = await tx.transaction.create({
    data: {
      nature: "adjustment",
      description,
      amount: amountStr,
      direction: deltaValue >= 0 ? "CREDIT" : "DEBIT",
      kind: "STOCK_VARIATION",
      accountId: variationAccountId,
      date: deltaDate,
    },
  });

  const journalEntry = await finalizeBatchToJournal(tx, {
    sourceType: "OTHER",
    sourceId: count.id,
    date: deltaDate,
    description,
    transactions: [assetTransaction, variationTransaction],
  });

  return journalEntry;
}

export async function postInventoryCount(id) {
  let normalized = null;
  await prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { product: { sku: "asc" } },
          include: {
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
        },
      },
    });
    if (!count) throw new Error("INVENTORY_COUNT_NOT_FOUND");

    if (count.status === "CANCELLED") {
      throw new Error("Inventaire annulé.");
    }
    if (count.status === "POSTED") {
      const refreshed = await tx.inventoryCount.findUnique({
        where: { id },
        include: COUNT_INCLUDE,
      });
      return normalizeInventoryCount(refreshed);
    }
    if (count.status !== "COMPLETED") {
      throw new Error(
        "L'inventaire doit être validé avant de générer les ajustements."
      );
    }

    const postedAt = new Date();
    const updatedLineIds = [];

    for (const line of count.lines) {
      const snapshotQty = toNumber(line.snapshotQty);
      const countedQty =
        line.countedQty == null ? snapshotQty : toNumber(line.countedQty);
      const deltaQty = countedQty - snapshotQty;

      let deltaValue = 0;
      let journalEntryId = null;

      if (Math.abs(deltaQty) > 1e-6) {
        const inventoryAccountId = line.product.inventoryAccountId;
        const variationAccountId = line.product.stockVariationAccountId;
        if (!inventoryAccountId || !variationAccountId) {
          throw new Error(
            `Comptes inventaire/variation manquants pour ${line.product.sku}.`
          );
        }

        const adjustResult = await applyAdjustMovement(tx, {
          productId: line.productId,
          qty: deltaQty,
          unitCost:
            deltaQty > 0
              ? line.snapshotAvgCost != null
                ? toNumber(line.snapshotAvgCost)
                : undefined
              : undefined,
        });

        const movement = await tx.stockMovement.create({
          data: {
            productId: line.productId,
            movementType: deltaQty >= 0 ? "ADJUST" : "ADJUST",
            stage: "AVAILABLE",
            quantity: toFixedString(Math.abs(deltaQty), 3),
            unitCost:
              adjustResult.unitCost != null
                ? toFixedString(adjustResult.unitCost, 4)
                : null,
            totalCost:
              adjustResult.totalCost != null
                ? toFixedString(
                    Math.abs(adjustResult.totalCost),
                    2
                  )
                : null,
            inventoryCountLineId: line.id,
          },
        });

        deltaValue =
          (adjustResult.totalCost ?? 0) * (deltaQty >= 0 ? 1 : -1);

        const description = buildAdjustmentDescription(count, line);
        const journalEntry = await createAdjustmentJournal({
          tx,
          count,
          line,
          inventoryAccountId,
          variationAccountId,
          deltaValue,
          deltaDate: postedAt,
          description,
        });

        journalEntryId = journalEntry?.id ?? null;

        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: {
            deltaQty: toFixedString(deltaQty, 3),
            deltaValue: toFixedString(deltaValue, 2),
            status: "POSTED",
            journalEntryId,
          },
        });
      } else {
        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: {
            deltaQty: "0.000",
            deltaValue: "0.00",
            status: "POSTED",
          },
        });
      }
      updatedLineIds.push(line.id);
    }

    await tx.inventoryCount.update({
      where: { id },
      data: { status: "POSTED", postedAt },
    });

    const refreshed = await tx.inventoryCount.findUnique({
      where: { id },
      include: COUNT_INCLUDE,
    });
    normalized = normalizeInventoryCount(refreshed);
  });
  if (normalized) {
    try {
      await sendInventoryCountNotification(normalized, "POSTED");
    } catch (error) {
      console.warn("Notification inventaire POSTED échouée", error);
    }
  }
  return normalized;
}

