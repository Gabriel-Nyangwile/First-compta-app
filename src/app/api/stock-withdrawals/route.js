import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  STOCK_WITHDRAWAL_TYPES,
  STOCK_WITHDRAWAL_STATUSES,
  nextStockWithdrawalNumber,
  normalizeStockWithdrawal,
  toNumber,
} from "@/lib/stockWithdrawal";
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

function sanitizeQuantity(value, idx) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty <= 0) {
    if (idx != null) {
      throw new Error(`Ligne ${idx + 1}: quantité invalide (doit être > 0).`);
    }
    throw new Error("Quantité de ligne invalide (doit être > 0).");
  }
  return qty;
}

function sanitizeType(value) {
  if (!value || !STOCK_WITHDRAWAL_TYPES.has(value)) {
    throw new Error("Type de sortie de stock invalide.");
  }
  return value;
}

function normalizeLinesForCreation(rawLines) {
  return rawLines.map((line, idx) => {
    if (!line?.productId) {
      throw new Error(`Ligne ${idx + 1}: productId requis.`);
    }
    const productId = String(line.productId);
    const quantity = sanitizeQuantity(line.quantity, idx);
    const lineNotes = line.notes ? String(line.notes).trim() : undefined;
    const salesOrderLineId = line.salesOrderLineId
      ? String(line.salesOrderLineId)
      : undefined;

    return {
      productId,
      quantity,
      notes: lineNotes,
      salesOrderLineId,
    };
  });
}

function normalizeListResponse(withdrawals) {
  return withdrawals.map((item) => {
    const totalQty = (item.lines || []).reduce(
      (sum, line) => sum + toNumber(line.quantity || 0),
      0
    );
    return {
      ...item,
      requestedAt:
        item.requestedAt?.toISOString?.() ?? item.requestedAt ?? null,
      confirmedAt:
        item.confirmedAt?.toISOString?.() ?? item.confirmedAt ?? null,
      postedAt: item.postedAt?.toISOString?.() ?? item.postedAt ?? null,
      totalQuantity: Number(totalQty.toFixed(3)),
    };
  });
}

export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const type = searchParams.get("type") || undefined;
    const salesOrderId = searchParams.get("salesOrderId") || undefined;
    const q = searchParams.get("q")?.trim();

    const where = { companyId };
    if (status && STOCK_WITHDRAWAL_STATUSES.has(status)) {
      where.status = status;
    }
    if (type && STOCK_WITHDRAWAL_TYPES.has(type)) {
      where.type = type;
    }
    if (salesOrderId) {
      where.lines = {
        some: {
          salesOrderLine: {
            salesOrderId,
          },
        },
      };
    }
    if (q) {
      where.OR = [
        { number: { contains: q, mode: "insensitive" } },
        { manufacturingOrderRef: { contains: q, mode: "insensitive" } },
        { salesOrderRef: { contains: q, mode: "insensitive" } },
      ];
    }

    const include = salesOrderId
      ? BASE_INCLUDE
      : {
          requestedBy: { select: { id: true, username: true, email: true } },
          lines: { select: { id: true, quantity: true } },
        };

    const withdrawals = await prisma.stockWithdrawal.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      include,
    });

    if (salesOrderId) {
      return NextResponse.json(
        withdrawals.map((item) => normalizeStockWithdrawal(item))
      );
    }

    return NextResponse.json(normalizeListResponse(withdrawals));
  } catch (error) {
    console.error("GET /stock-withdrawals error", error);
    return NextResponse.json(
      { error: "Erreur récupération sorties de stock." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const body = await request.json();
    const type = sanitizeType(String(body.type || "").toUpperCase());
    const notes = body.notes ? String(body.notes).trim() : undefined;
    const manufacturingOrderRef = body.manufacturingOrderRef
      ? String(body.manufacturingOrderRef).trim()
      : undefined;
    const salesOrderRef = body.salesOrderRef
      ? String(body.salesOrderRef).trim()
      : undefined;
    const requestedById = body.requestedById
      ? String(body.requestedById)
      : undefined;

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (!rawLines.length) {
      return NextResponse.json(
        { error: "Au moins une ligne de produit est requise." },
        { status: 400 }
      );
    }

    const lines = normalizeLinesForCreation(rawLines);

    const created = await prisma.$transaction(async (tx) => {
      if (requestedById) {
        const requester = await tx.user.findUnique({
          where: { id: requestedById },
          select: { id: true },
        });
        if (!requester) {
          throw new Error("Utilisateur demandeur introuvable.");
        }
      }

      const productIds = [...new Set(lines.map((line) => line.productId))];
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

      const number = await nextStockWithdrawalNumber(tx, companyId);

      if (type === "SALE") {
        if (lines.some((line) => !line.salesOrderLineId)) {
          throw new Error(
            "Chaque ligne doit être liée à une ligne de commande client pour une sortie VENTE."
          );
        }
      }

      const salesOrderLineIds = lines
        .map((line) => line.salesOrderLineId)
        .filter(Boolean);
      let salesOrderLines = [];
      if (salesOrderLineIds.length) {
        salesOrderLines = await tx.salesOrderLine.findMany({
          where: { id: { in: salesOrderLineIds }, companyId },
          include: {
            salesOrder: { select: { id: true, status: true } },
          },
        });
        if (salesOrderLines.length !== salesOrderLineIds.length) {
          throw new Error(
            "Certaines lignes de commande client sont introuvables."
          );
        }
      }
      const salesOrderLineMap = new Map(
        salesOrderLines.map((line) => [line.id, line])
      );

      for (const line of lines) {
        if (!line.salesOrderLineId) continue;
        const related = salesOrderLineMap.get(line.salesOrderLineId);
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
        if (related.productId !== line.productId) {
          throw new Error(
            "Le produit de la ligne de commande ne correspond pas à la sortie."
          );
        }
        const remaining =
          toNumber(related.quantityOrdered) -
          toNumber(related.quantityShipped) -
          toNumber(related.quantityAllocated);
        if (line.quantity > remaining + 1e-9) {
          throw new Error(
            "Quantité demandée supérieure au solde préparable de la commande."
          );
        }
      }

      const withdrawal = await tx.stockWithdrawal.create({
        data: {
          number,
          companyId,
          type,
          notes: notes || null,
          requestedById: requestedById || null,
          manufacturingOrderRef: manufacturingOrderRef || null,
          salesOrderRef: salesOrderRef || null,
          lines: {
            create: lines.map((line) => ({
              companyId,
              productId: line.productId,
              quantity: line.quantity.toFixed(3),
              notes: line.notes || null,
              salesOrderLineId: line.salesOrderLineId || null,
            })),
          },
        },
        include: BASE_INCLUDE,
      });

      return withdrawal;
    });

    return NextResponse.json(normalizeStockWithdrawal(created), {
      status: 201,
    });
  } catch (error) {
    if (
      error?.message?.startsWith("Ligne") ||
      error?.message ===
        "Chaque ligne doit être liée à une ligne de commande client pour une sortie VENTE." ||
      error?.message ===
        "Certaines lignes de commande client sont introuvables." ||
      error?.message ===
        "Ligne de commande client introuvable pour la sortie." ||
      error?.message ===
        "Seules les commandes confirmées peuvent être préparées." ||
      error?.message ===
        "Le produit de la ligne de commande ne correspond pas à la sortie." ||
      error?.message ===
        "Quantité demandée supérieure au solde préparable de la commande."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error?.message === "Utilisateur demandeur introuvable." ||
      error?.message ===
        "Certains produits spécifiés pour la sortie sont introuvables."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.message === "Type de sortie de stock invalide.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("POST /stock-withdrawals error", error);
    return NextResponse.json(
      { error: "Erreur création sortie de stock." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
