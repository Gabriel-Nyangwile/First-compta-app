import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  STOCK_WITHDRAWAL_TYPES,
  STOCK_WITHDRAWAL_STATUSES,
  canTransitionStatus,
  normalizeStockWithdrawal,
  toNumber,
} from "@/lib/stockWithdrawal";
import { applyOutMovement } from "@/lib/inventory";
import { requireCompanyId } from "@/lib/tenant";

const BASE_INCLUDE = {
  requestedBy: { select: { id: true, username: true, email: true } },
  lines: {
    include: {
      product: {
        select: { id: true, sku: true, name: true, unit: true },
      },
      movements: true,
      salesOrderLine: {
        select: {
          id: true,
          productId: true,
          quantityOrdered: true,
          quantityAllocated: true,
          quantityShipped: true,
          quantityInvoiced: true,
          salesOrder: {
            select: { id: true, number: true, status: true },
          },
        },
      },
    },
  },
};

function sanitizeType(value) {
  if (!value) return undefined;
  const upper = String(value).toUpperCase();
  if (!STOCK_WITHDRAWAL_TYPES.has(upper)) {
    throw new Error("Type de sortie de stock invalide.");
  }
  return upper;
}

function sanitizeQuantity(value, idx) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty <= 0) {
    if (idx != null) {
      throw new Error(`Ligne ${idx + 1}: quantité invalide.`);
    }
    throw new Error("Quantité invalide.");
  }
  return qty;
}

function aggregateLineQuantities(lines) {
  const map = new Map();
  for (const line of lines || []) {
    if (!line?.salesOrderLineId) continue;
    const sourceQuantity = line.quantity ?? line.quantityOrdered ?? 0;
    const qty =
      typeof sourceQuantity === "number"
        ? sourceQuantity
        : toNumber(sourceQuantity);
    if (qty <= 0) continue;
    const current = map.get(line.salesOrderLineId) ?? 0;
    map.set(line.salesOrderLineId, current + qty);
  }
  return map;
}

async function fetchSalesOrderLines(tx, ids, companyId) {
  if (!ids.length) return new Map();
  const rows = await tx.salesOrderLine.findMany({
    where: { id: { in: ids }, ...(companyId ? { companyId } : {}) },
    include: {
      salesOrder: { select: { id: true, status: true } },
    },
  });
  if (rows.length !== ids.length) {
    throw new Error("Certaines lignes de commande client sont introuvables.");
  }
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadWithdrawal(tx, id, companyId) {
  const withdrawal = await tx.stockWithdrawal.findFirst({
    where: { id, ...(companyId ? { companyId } : {}) },
    include: BASE_INCLUDE,
  });
  if (!withdrawal) {
    throw new Error("SORTIE_INTRouvable");
  }
  return withdrawal;
}

export async function GET(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const params = await Promise.resolve(context?.params ?? context);
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.stockWithdrawal.findFirst({
      where: { id, companyId },
      include: BASE_INCLUDE,
    });
    if (!withdrawal) {
      return NextResponse.json(
        { error: "Sortie de stock introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(normalizeStockWithdrawal(withdrawal));
  } catch (error) {
    if (error?.message === "SORTIE_INTRouvable") {
      return NextResponse.json(
        { error: "Sortie de stock introuvable." },
        { status: 404 }
      );
    }
    console.error("GET /stock-withdrawals/[id] error", error);
    return NextResponse.json(
      { error: "Erreur récupération sortie de stock." },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  const params = await Promise.resolve(context?.params ?? context);
  const id = params?.id;
  if (!id) {
    return NextResponse.json(
      { error: "Paramètre id manquant." },
      { status: 400 }
    );
  }

  try {
    const companyId = requireCompanyId(request);
    const body = await request.json().catch(() => ({}));
    const action = body?.action ? String(body.action).toUpperCase() : null;
    if (!action) {
      return NextResponse.json({ error: "Action requise." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const withdrawal = await loadWithdrawal(tx, id, companyId);

      if (action === "UPDATE") {
        if (withdrawal.status !== "DRAFT") {
          throw new Error(
            "La mise à jour des lignes n'est possible qu'au statut DRAFT."
          );
        }

        const nextType = sanitizeType(body.type) ?? withdrawal.type;
        const notes = body.notes ? String(body.notes).trim() : null;
        const manufacturingOrderRef = body.manufacturingOrderRef
          ? String(body.manufacturingOrderRef).trim()
          : null;
        const salesOrderRef = body.salesOrderRef
          ? String(body.salesOrderRef).trim()
          : null;
        const requestedById = body.requestedById
          ? String(body.requestedById)
          : withdrawal.requestedById ?? null;

        if (requestedById) {
          const exists = await tx.user.findUnique({
            where: { id: requestedById },
            select: { id: true },
          });
          if (!exists) {
            throw new Error("Utilisateur demandeur introuvable.");
          }
        }

        const rawLines = Array.isArray(body.lines) ? body.lines : [];
        if (!rawLines.length) {
          throw new Error("Au moins une ligne est requise.");
        }

        const sanitizedLines = rawLines.map((line, idx) => {
          if (!line?.productId) {
            throw new Error(`Ligne ${idx + 1}: productId requis.`);
          }
          return {
            productId: String(line.productId),
            quantity: sanitizeQuantity(line.quantity, idx),
            notes: line.notes ? String(line.notes).trim() : null,
            salesOrderLineId: line.salesOrderLineId
              ? String(line.salesOrderLineId)
              : undefined,
          };
        });

        if (nextType === "SALE") {
          if (sanitizedLines.some((line) => !line.salesOrderLineId)) {
            throw new Error(
              "Chaque ligne doit être liée à une ligne de commande client pour une sortie VENTE."
            );
          }
        }

        const productIds = [...new Set(sanitizedLines.map((l) => l.productId))];
        if (productIds.length) {
          const products = await tx.product.findMany({
            where: { id: { in: productIds }, companyId },
            select: { id: true },
          });
          if (products.length !== productIds.length) {
            throw new Error(
              "Certains produits spécifiés pour la sortie sont introuvables."
            );
          }
        }

        const salesOrderLineIds = sanitizedLines
          .map((line) => line.salesOrderLineId)
          .filter(Boolean);
        let salesOrderLineMap = new Map();
        if (salesOrderLineIds.length) {
          salesOrderLineMap = await fetchSalesOrderLines(
            tx,
            salesOrderLineIds,
            companyId
          );

          const aggregated = new Map();
          for (const line of sanitizedLines) {
            if (!line.salesOrderLineId) continue;
            const prev = aggregated.get(line.salesOrderLineId) ?? 0;
            aggregated.set(line.salesOrderLineId, prev + line.quantity);
          }

          for (const [lineId, qty] of aggregated.entries()) {
            const related = salesOrderLineMap.get(lineId);
            if (!related) {
              throw new Error(
                "Ligne de commande client introuvable pour la sortie."
              );
            }
            if (related.salesOrder.status !== "CONFIRMED") {
              throw new Error(
                "Seules les commandes confirmées peuvent être préparées."
              );
            }
            const remaining =
              toNumber(related.quantityOrdered) -
              toNumber(related.quantityShipped) -
              toNumber(related.quantityAllocated);
            if (qty > remaining + 1e-9) {
              throw new Error(
                "Quantité demandée supérieure au solde préparable de la commande."
              );
            }
          }

          for (const line of sanitizedLines) {
            if (!line.salesOrderLineId) continue;
            const related = salesOrderLineMap.get(line.salesOrderLineId);
            if (related.productId !== line.productId) {
              throw new Error(
                "Le produit de la ligne de commande ne correspond pas à la sortie."
              );
            }
          }
        }

        await tx.stockWithdrawalLine.deleteMany({
          where: { stockWithdrawalId: id, companyId },
        });

        for (const line of sanitizedLines) {
          await tx.stockWithdrawalLine.create({
            data: {
              stockWithdrawalId: id,
              companyId,
              productId: line.productId,
              quantity: line.quantity.toFixed(3),
              notes: line.notes,
              salesOrderLineId:
                nextType === "SALE" ? line.salesOrderLineId || null : null,
            },
          });
        }

        await tx.stockWithdrawal.updateMany({
          where: { id, companyId },
          data: {
            type: nextType,
            notes,
            manufacturingOrderRef,
            salesOrderRef,
            requestedById,
          },
        });

        const refreshed = await loadWithdrawal(tx, id, companyId);
        return refreshed;
      }

      if (action === "CONFIRM") {
        if (withdrawal.status !== "DRAFT") {
          throw new Error("Seules les sorties DRAFT peuvent être confirmées.");
        }
        if (!(withdrawal.lines || []).length) {
          throw new Error("Impossible de confirmer sans ligne de produit.");
        }

        if (withdrawal.type === "SALE") {
          const aggregated = aggregateLineQuantities(withdrawal.lines);
          const ids = Array.from(aggregated.keys());
          const salesOrderLineMap = await fetchSalesOrderLines(
            tx,
            ids,
            companyId
          );

          for (const [lineId, qty] of aggregated.entries()) {
            const related = salesOrderLineMap.get(lineId);
            if (!related) {
              throw new Error(
                "Ligne de commande client introuvable pour la sortie."
              );
            }
            if (related.salesOrder.status !== "CONFIRMED") {
              throw new Error(
                "Seules les commandes confirmées peuvent être préparées."
              );
            }
            const remaining =
              toNumber(related.quantityOrdered) -
              toNumber(related.quantityShipped) -
              toNumber(related.quantityAllocated);
            if (qty > remaining + 1e-9) {
              throw new Error(
                "Quantité demandée supérieure au solde préparable de la commande."
              );
            }

            const nextAllocated = toNumber(related.quantityAllocated) + qty;
            await tx.salesOrderLine.updateMany({
              where: { id: lineId, companyId },
              data: { quantityAllocated: nextAllocated.toFixed(3) },
            });
          }
        }

        await tx.stockWithdrawal.updateMany({
          where: { id, companyId },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });
        const refreshed = await loadWithdrawal(tx, id, companyId);
        return refreshed;
      }

      if (action === "POST") {
        if (withdrawal.status !== "CONFIRMED") {
          throw new Error(
            "Seules les sorties confirmées peuvent être mises en stock."
          );
        }
        const lines = withdrawal.lines || [];
        if (!lines.length) {
          throw new Error("Impossible de poster sans lignes.");
        }

        for (const line of lines) {
          if ((line.movements || []).length) {
            throw new Error(
              "Cette sortie a déjà des mouvements stock associés."
            );
          }
        }

        const postingDate = new Date();
        const salesOrderAggregates =
          withdrawal.type === "SALE"
            ? aggregateLineQuantities(lines)
            : new Map();

        for (const line of lines) {
          const qty = toNumber(line.quantity);
          if (qty <= 0) {
            throw new Error("Quantité de ligne invalide pour la sortie.");
          }
          const outResult = await applyOutMovement(tx, {
            productId: line.productId,
            qty,
            companyId,
          });
          const unitCost = Number.isFinite(outResult.unitCost)
            ? outResult.unitCost
            : 0;
          const totalCost = Number.isFinite(outResult.totalCost)
            ? outResult.totalCost
            : unitCost * qty;

          await tx.stockWithdrawalLine.update({
            where: { id: line.id },
            data: {
              unitCost: unitCost.toFixed(4),
              totalCost: totalCost.toFixed(2),
              updatedAt: postingDate,
            },
          });

          await tx.stockMovement.create({
            data: {
              date: postingDate,
              companyId,
              productId: line.productId,
              movementType: "OUT",
              stage: "AVAILABLE",
              quantity: qty.toFixed(3),
              unitCost: unitCost.toFixed(4),
              totalCost: totalCost.toFixed(2),
              stockWithdrawalLineId: line.id,
            },
          });
        }

        if (withdrawal.type === "SALE" && salesOrderAggregates.size) {
          const ids = Array.from(salesOrderAggregates.keys());
          const salesOrderLineMap = await fetchSalesOrderLines(
            tx,
            ids,
            companyId
          );
          const impactedOrderIds = new Set();

          for (const [lineId, qty] of salesOrderAggregates.entries()) {
            const related = salesOrderLineMap.get(lineId);
            if (!related) {
              throw new Error(
                "Ligne de commande client introuvable pour la sortie."
              );
            }
            const currentAllocated = toNumber(related.quantityAllocated);
            const currentShipped = toNumber(related.quantityShipped);
            const nextAllocated = currentAllocated - qty;
            if (nextAllocated < -1e-6) {
              throw new Error(
                "Allocation incohérente pour la commande client (quantité négative)."
              );
            }
            const updatedAllocated = Math.max(0, nextAllocated);
            const updatedShipped = currentShipped + qty;

            await tx.salesOrderLine.updateMany({
              where: { id: lineId, companyId },
              data: {
                quantityAllocated: updatedAllocated.toFixed(3),
                quantityShipped: updatedShipped.toFixed(3),
              },
            });

            impactedOrderIds.add(related.salesOrderId);
          }

          for (const orderId of impactedOrderIds.values()) {
            const orderLines = await tx.salesOrderLine.findMany({
              where: { salesOrderId: orderId, companyId },
              select: {
                quantityOrdered: true,
                quantityShipped: true,
              },
            });
            const allFulfilled = orderLines.every(
              (line) =>
                toNumber(line.quantityShipped) + 1e-9 >=
                toNumber(line.quantityOrdered)
            );
            if (allFulfilled) {
              await tx.salesOrder.updateMany({
                where: { id: orderId, companyId, status: { not: "FULFILLED" } },
                data: {
                  status: "FULFILLED",
                  fulfilledAt: new Date(),
                },
              });
            }
          }
        }

        await tx.stockWithdrawal.updateMany({
          where: { id, companyId },
          data: {
            status: "POSTED",
            postedAt: postingDate,
            updatedAt: postingDate,
          },
        });

        const refreshed = await loadWithdrawal(tx, id, companyId);
        return refreshed;
      }

      if (action === "CANCEL") {
        if (withdrawal.status === "POSTED") {
          throw new Error("Impossible d'annuler une sortie déjà postée.");
        }
        if (withdrawal.status === "CANCELLED") {
          return withdrawal;
        }

        if (withdrawal.type === "SALE" && withdrawal.status === "CONFIRMED") {
          const aggregated = aggregateLineQuantities(withdrawal.lines);
          const ids = Array.from(aggregated.keys());
          const salesOrderLineMap = await fetchSalesOrderLines(
            tx,
            ids,
            companyId
          );
          for (const [lineId, qty] of aggregated.entries()) {
            const related = salesOrderLineMap.get(lineId);
            if (!related) continue;
            const currentAllocated = toNumber(related.quantityAllocated);
            const nextAllocated = Math.max(0, currentAllocated - qty);
            await tx.salesOrderLine.updateMany({
              where: { id: lineId, companyId },
              data: { quantityAllocated: nextAllocated.toFixed(3) },
            });
          }
        }

        await tx.stockWithdrawal.updateMany({
          where: { id, companyId },
          data: { status: "CANCELLED" },
        });
        const refreshed = await loadWithdrawal(tx, id, companyId);
        return refreshed;
      }

      if (!STOCK_WITHDRAWAL_STATUSES.has(action)) {
        throw new Error("Action non reconnue pour la sortie de stock.");
      }

      if (!canTransitionStatus(withdrawal.status, action)) {
        throw new Error("Transition de statut invalide.");
      }

      await tx.stockWithdrawal.updateMany({
        where: { id, companyId },
        data: { status: action },
      });
      const refreshed = await loadWithdrawal(tx, id, companyId);
      return refreshed;
    });

    return NextResponse.json(normalizeStockWithdrawal(result));
  } catch (error) {
    if (error?.message === "SORTIE_INTRouvable") {
      return NextResponse.json(
        { error: "Sortie de stock introuvable." },
        { status: 404 }
      );
    }
    if (error?.message) {
      if (
        error.message.includes("productId requis") ||
        error.message.includes("Quantité") ||
        error.message.includes("Au moins une ligne") ||
        error.message === "Utilisateur demandeur introuvable." ||
        error.message ===
          "Certains produits spécifiés pour la sortie sont introuvables." ||
        error.message.startsWith("La mise à jour") ||
        error.message.startsWith("Seules les sorties") ||
        error.message.startsWith(
          "Chaque ligne doit être liée à une ligne de commande client"
        ) ||
        error.message ===
          "Certaines lignes de commande client sont introuvables." ||
        error.message ===
          "Ligne de commande client introuvable pour la sortie." ||
        error.message ===
          "Seules les commandes confirmées peuvent être préparées." ||
        error.message.startsWith("Impossible de confirmer") ||
        error.message.startsWith("Cette sortie a déjà des mouvements") ||
        error.message.startsWith("Impossible d'annuler") ||
        error.message ===
          "Quantité demandée supérieure au solde préparable de la commande." ||
        error.message ===
          "Le produit de la ligne de commande ne correspond pas à la sortie." ||
        error.message ===
          "Allocation incohérente pour la commande client (quantité négative)." ||
        error.message === "Type de sortie de stock invalide." ||
        error.message === "Transition de statut invalide." ||
        error.message === "Action non reconnue pour la sortie de stock." ||
        error.message.startsWith("Impossible de poster") ||
        error.message.includes("Stock insuffisant") ||
        error.message.includes("qty invalide")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("PUT /stock-withdrawals/[id] error", error);
    return NextResponse.json(
      { error: "Erreur mise à jour sortie de stock." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
