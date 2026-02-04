import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";
import {
  SALES_ORDER_STATUSES,
  canTransitionStatus,
  computeSalesOrderTotals,
  normalizeSalesOrder,
  toNumber,
} from "@/lib/salesOrder";

const BASE_INCLUDE = {
  client: { select: { id: true, name: true } },
  lines: {
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
      account: { select: { id: true, number: true, label: true } },
      stockWithdrawalLines: {
        include: {
          stockWithdrawal: {
            select: { id: true, number: true, status: true, postedAt: true },
          },
        },
      },
      invoiceLines: {
        select: {
          id: true,
          invoiceId: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              issueDate: true,
            },
          },
        },
      },
    },
  },
};

async function loadOrder(tx, id, companyId) {
  const order = await tx.salesOrder.findUnique({
    where: { id, companyId },
    include: BASE_INCLUDE,
  });
  if (!order) {
    throw new Error("SALES_ORDER_NOT_FOUND");
  }
  return order;
}

function sanitizeLines(rawLines) {
  if (!Array.isArray(rawLines) || !rawLines.length) {
    throw new Error("Au moins une ligne de commande est requise.");
  }

  return rawLines.map((line, idx) => {
    if (!line?.productId) {
      throw new Error(`Ligne ${idx + 1}: productId requis.`);
    }
    const productId = String(line.productId);
    if (!line?.accountId) {
      throw new Error(`Ligne ${idx + 1}: accountId requis.`);
    }
    const accountId = String(line.accountId);
    const qty = Number(line.quantityOrdered);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Ligne ${idx + 1}: quantité invalide.`);
    }
    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Ligne ${idx + 1}: prix unitaire invalide.`);
    }
    let vatRate = null;
    if (
      line.vatRate !== null &&
      line.vatRate !== undefined &&
      line.vatRate !== ""
    ) {
      vatRate = Number(line.vatRate);
      if (!Number.isFinite(vatRate) || vatRate < 0) {
        throw new Error(`Ligne ${idx + 1}: taux de TVA invalide.`);
      }
    }
    const lineTotalHt = qty * unitPrice;
    const lineTotalTtc =
      vatRate != null ? lineTotalHt * (1 + vatRate) : lineTotalHt;

    return {
      productId,
      accountId,
      quantity: qty,
      unitPrice,
      vatRate,
      description: line.description
        ? String(line.description).trim()
        : undefined,
      unit: line.unit ? String(line.unit).trim() : undefined,
      notes: line.notes ? String(line.notes).trim() : undefined,
      lineTotalHt,
      lineTotalTtc,
    };
  });
}

function buildTotalsPayload(lines) {
  const totals = computeSalesOrderTotals(lines);
  const vatAmount = totals.totalAmountTtc - totals.totalAmountHt;
  return {
    totalQuantity: totals.totalQuantity.toFixed(3),
    totalAmountHt: totals.totalAmountHt.toFixed(2),
    totalAmountTtc: totals.totalAmountTtc.toFixed(2),
    totalVatAmount: vatAmount.toFixed(2),
  };
}

export async function GET(_request, context) {
  try {
    const companyId = requireCompanyId(_request);
    const params = await Promise.resolve(context?.params ?? context);
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );
    }

    const order = await prisma.salesOrder.findUnique({
      where: { id, companyId },
      include: BASE_INCLUDE,
    });
    if (!order) {
      return NextResponse.json(
        { error: "Commande client introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(normalizeSalesOrder(order));
  } catch (error) {
    console.error("GET /sales-orders/[id] error", error);
    return NextResponse.json(
      { error: "Erreur récupération commande client." },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  const companyId = requireCompanyId(request);
  const params = await Promise.resolve(context?.params ?? context);
  const id = params?.id;
  if (!id) {
    return NextResponse.json(
      { error: "Paramètre id manquant." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action ? String(body.action).toUpperCase() : null;
    if (!action) {
      return NextResponse.json({ error: "Action requise." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await loadOrder(tx, id, companyId);

      if (action === "UPDATE") {
        if (order.status !== "DRAFT") {
          throw new Error(
            "La commande ne peut être modifiée qu'au statut DRAFT."
          );
        }
        const hasProgress = (order.lines || []).some((line) => {
          return (
            toNumber(line.quantityAllocated) > 0 ||
            toNumber(line.quantityShipped) > 0 ||
            toNumber(line.quantityInvoiced) > 0 ||
            (line.invoiceLines || []).length > 0 ||
            (line.stockWithdrawalLines || []).length > 0
          );
        });
        if (hasProgress) {
          throw new Error(
            "Impossible de modifier une commande ayant déjà des préparations ou factures."
          );
        }

        const sanitizedLines = sanitizeLines(body.lines);

        const productIds = [
          ...new Set(sanitizedLines.map((line) => line.productId)),
        ];
        const products = productIds.length
          ? await tx.product.findMany({
              where: { id: { in: productIds }, companyId },
              select: { id: true, name: true, unit: true },
            })
          : [];
        if (products.length !== productIds.length) {
          throw new Error("Certains produits sont introuvables.");
        }
        const productMap = new Map(products.map((p) => [p.id, p]));

        const accountIds = [
          ...new Set(sanitizedLines.map((line) => line.accountId)),
        ];
        const accounts = accountIds.length
          ? await tx.account.findMany({
              where: { id: { in: accountIds }, companyId },
              select: { id: true },
            })
          : [];
        if (accounts.length !== accountIds.length) {
          throw new Error("Certains comptes comptables sont introuvables.");
        }

        await tx.salesOrderLine.deleteMany({
          where: { salesOrderId: id, companyId },
        });

        await tx.salesOrder.update({
          where: { id, companyId },
          data: {
            issueDate: body.issueDate
              ? new Date(body.issueDate)
              : order.issueDate,
            expectedShipDate: body.expectedShipDate
              ? new Date(body.expectedShipDate)
              : order.expectedShipDate,
            notes: body.notes ? String(body.notes).trim() : null,
            customerReference: body.customerReference
              ? String(body.customerReference).trim()
              : null,
            currency: body.currency ? String(body.currency) : order.currency,
            lines: {
              create: sanitizedLines.map((line) => {
                const product = productMap.get(line.productId);
                const resolvedDescription =
                  line.description || product?.name || null;
                const resolvedUnit = line.unit || product?.unit || null;
                return {
                  companyId,
                  productId: line.productId,
                  accountId: line.accountId,
                  description: resolvedDescription,
                  unit: resolvedUnit,
                  quantityOrdered: line.quantity.toFixed(3),
                  unitPrice: line.unitPrice.toFixed(4),
                  vatRate:
                    line.vatRate != null ? line.vatRate.toFixed(2) : null,
                  lineTotalHt: line.lineTotalHt.toFixed(2),
                  lineTotalTtc: line.lineTotalTtc.toFixed(2),
                  notes: line.notes || null,
                };
              }),
            },
            ...buildTotalsPayload(sanitizedLines),
          },
        });

        const refreshed = await loadOrder(tx, id, companyId);
        return refreshed;
      }

      if (action === "CONFIRM") {
        if (order.status !== "DRAFT") {
          throw new Error(
            "Seules les commandes au statut DRAFT peuvent être confirmées."
          );
        }
        if (!(order.lines || []).length) {
          throw new Error("Impossible de confirmer une commande sans lignes.");
        }

        await tx.salesOrder.update({
          where: { id, companyId },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
        });

        const refreshed = await loadOrder(tx, id, companyId);
        return refreshed;
      }

      if (action === "FULFILL") {
        if (!canTransitionStatus(order.status, "FULFILLED")) {
          throw new Error("Transition de statut invalide vers FULFILLED.");
        }

        const hasPending = (order.lines || []).some((line) => {
          return (
            toNumber(line.quantityShipped) + 1e-9 <
            toNumber(line.quantityOrdered)
          );
        });
        if (hasPending) {
          throw new Error(
            "Toutes les lignes doivent être expédiées avant de clôturer la commande."
          );
        }

        await tx.salesOrder.update({
          where: { id, companyId },
          data: {
            status: "FULFILLED",
            fulfilledAt: new Date(),
          },
        });

        const refreshed = await loadOrder(tx, id, companyId);
        return refreshed;
      }

      if (SALES_ORDER_STATUSES.has(action)) {
        if (!canTransitionStatus(order.status, action)) {
          throw new Error("Transition de statut invalide.");
        }

        await tx.salesOrder.update({
          where: { id, companyId },
          data: {
            status: action,
            confirmedAt:
              action === "CONFIRMED" ? new Date() : order.confirmedAt,
            fulfilledAt:
              action === "FULFILLED" ? new Date() : order.fulfilledAt,
          },
        });
        const refreshed = await loadOrder(tx, id, companyId);
        return refreshed;
      }

      throw new Error("Action non reconnue pour la commande client.");
    });

    return NextResponse.json(normalizeSalesOrder(result));
  } catch (error) {
    if (error?.message === "SALES_ORDER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Commande client introuvable." },
        { status: 404 }
      );
    }

    if (
      error?.message?.startsWith("Ligne") ||
      error?.message === "Au moins une ligne de commande est requise." ||
      error?.message === "Certains produits sont introuvables." ||
      error?.message?.startsWith("La commande ne peut être modifiée") ||
      error?.message?.startsWith("Impossible de modifier") ||
      error?.message?.startsWith("Seules les commandes") ||
      error?.message?.startsWith("Impossible de confirmer") ||
      error?.message?.startsWith("Toutes les lignes doivent") ||
      error?.message === "Transition de statut invalide vers FULFILLED." ||
      error?.message === "Transition de statut invalide." ||
      error?.message === "Certains comptes comptables sont introuvables."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("PUT /sales-orders/[id] error", error);
    return NextResponse.json(
      { error: "Erreur mise à jour commande client." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
