import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  computeSalesOrderTotals,
  nextSalesOrderNumber,
  normalizeSalesOrder,
  toNumber,
} from "@/lib/salesOrder";

const BASE_INCLUDE = {
  client: { select: { id: true, name: true } },
  lines: {
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true } },
      account: { select: { id: true, number: true, label: true } },
    },
  },
};

function sanitizeQuantity(value, idx) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(`Ligne ${idx + 1}: quantité invalide.`);
  }
  return qty;
}

function sanitizeUnitPrice(value, idx) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Ligne ${idx + 1}: prix unitaire invalide.`);
  }
  return price;
}

function sanitizeVatRate(value, idx) {
  if (value === null || value === undefined || value === "") return null;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Ligne ${idx + 1}: taux de TVA invalide.`);
  }
  return rate;
}

function buildOrderTotalsPayload(lines) {
  const totals = computeSalesOrderTotals(lines);
  const vatAmount = totals.totalAmountTtc - totals.totalAmountHt;
  return {
    totalQuantity: totals.totalQuantity.toFixed(3),
    totalAmountHt: totals.totalAmountHt.toFixed(2),
    totalAmountTtc: totals.totalAmountTtc.toFixed(2),
    totalVatAmount: vatAmount.toFixed(2),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const clientId = searchParams.get("clientId") || undefined;
    const remainingOnlyRaw = searchParams.get("remaining");
    const remainingOnly =
      remainingOnlyRaw === "1" ||
      remainingOnlyRaw === "true" ||
      remainingOnlyRaw === "yes";
    const q = searchParams.get("q")?.trim();

    const where = {};
    if (status) {
      where.status = status;
    }
    if (clientId) {
      where.clientId = clientId;
    }
    if (q) {
      where.OR = [
        { number: { contains: q, mode: "insensitive" } },
        { customerReference: { contains: q, mode: "insensitive" } },
      ];
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      orderBy: { issueDate: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        lines: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityInvoiced: true,
          },
        },
      },
    });

    const normalized = orders
      .map((order) => {
        const lines = (order.lines || []).map((line) => {
          const quantityOrdered = toNumber(line.quantityOrdered);
          const quantityInvoiced = toNumber(line.quantityInvoiced);
          const remainingQuantity = Math.max(
            0,
            quantityOrdered - quantityInvoiced
          );
          return {
            id: line.id,
            quantityOrdered,
            quantityInvoiced,
            remainingQuantity,
          };
        });

        return {
          id: order.id,
          number: order.number,
          status: order.status,
          client: order.client,
          issueDate: order.issueDate?.toISOString?.() ?? order.issueDate,
          expectedShipDate:
            order.expectedShipDate?.toISOString?.() ?? order.expectedShipDate,
          confirmedAt: order.confirmedAt?.toISOString?.() ?? order.confirmedAt,
          fulfilledAt: order.fulfilledAt?.toISOString?.() ?? order.fulfilledAt,
          totalQuantity: toNumber(order.totalQuantity),
          totalAmountHt: toNumber(order.totalAmountHt),
          totalAmountTtc: toNumber(order.totalAmountTtc),
          totalVatAmount: toNumber(order.totalVatAmount),
          lines,
        };
      })
      .filter((order) => {
        if (!remainingOnly) return true;
        return (order.lines || []).some(
          (line) => line.remainingQuantity > 1e-6
        );
      });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("GET /sales-orders error", error);
    return NextResponse.json(
      { error: "Erreur récupération commandes clients." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      clientId,
      issueDate,
      expectedShipDate,
      currency = "EUR",
      notes,
      customerReference,
      lines,
    } = body;

    const rawLines = Array.isArray(lines) ? lines : [];
    if (!rawLines.length) {
      return NextResponse.json(
        { error: "Au moins une ligne de commande est requise." },
        { status: 400 }
      );
    }

    const normalizedLines = rawLines.map((line, idx) => {
      if (!line?.productId) {
        throw new Error(`Ligne ${idx + 1}: productId requis.`);
      }
      const productId = String(line.productId);
      const quantity = sanitizeQuantity(line.quantityOrdered, idx);
      const unitPrice = sanitizeUnitPrice(line.unitPrice, idx);
      const vatRate = sanitizeVatRate(line.vatRate, idx);
      const lineNotes = line.notes ? String(line.notes).trim() : undefined;
      const description = line.description
        ? String(line.description).trim()
        : undefined;
      const unit = line.unit ? String(line.unit).trim() : undefined;
      const accountId = line.accountId ? String(line.accountId) : null;
      if (!accountId) {
        throw new Error(`Ligne ${idx + 1}: accountId requis.`);
      }

      const lineTotalHt = quantity * unitPrice;
      const lineTotalTtc =
        vatRate != null ? lineTotalHt * (1 + vatRate) : lineTotalHt;

      return {
        productId,
        quantity,
        unitPrice,
        vatRate,
        lineNotes,
        description,
        unit,
        accountId,
        lineTotalHt,
        lineTotalTtc,
      };
    });

    const order = await prisma.$transaction(async (tx) => {
      if (clientId) {
        const exists = await tx.client.findUnique({
          where: { id: String(clientId) },
          select: { id: true },
        });
        if (!exists) {
          throw new Error("Client introuvable.");
        }
      }

      const productIds = [
        ...new Set(normalizedLines.map((line) => line.productId)),
      ];
      const products = productIds.length
        ? await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, unit: true },
          })
        : [];
      if (products.length !== productIds.length) {
        throw new Error("Certains produits sont introuvables.");
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      const accountIds = [
        ...new Set(normalizedLines.map((line) => line.accountId)),
      ];
      const accounts = accountIds.length
        ? await tx.account.findMany({
            where: { id: { in: accountIds } },
            select: { id: true },
          })
        : [];
      if (accounts.length !== accountIds.length) {
        throw new Error("Certains comptes comptables sont introuvables.");
      }

      const number = await nextSalesOrderNumber(tx);

      const lineCreates = normalizedLines.map((line) => {
        const product = productMap.get(line.productId);
        const resolvedDescription = line.description || product?.name || null;
        const resolvedUnit = line.unit || product?.unit || null;
        return {
          productId: line.productId,
          accountId: line.accountId,
          description: resolvedDescription,
          unit: resolvedUnit,
          quantityOrdered: line.quantity.toFixed(3),
          unitPrice: line.unitPrice.toFixed(4),
          vatRate: line.vatRate != null ? line.vatRate.toFixed(2) : null,
          lineTotalHt: line.lineTotalHt.toFixed(2),
          lineTotalTtc: line.lineTotalTtc.toFixed(2),
          notes: line.lineNotes || null,
        };
      });

      const totalsPayload = buildOrderTotalsPayload(normalizedLines);

      const created = await tx.salesOrder.create({
        data: {
          number,
          clientId: clientId ? String(clientId) : null,
          issueDate: issueDate ? new Date(issueDate) : undefined,
          expectedShipDate: expectedShipDate
            ? new Date(expectedShipDate)
            : undefined,
          currency,
          notes: notes ? String(notes).trim() : null,
          customerReference: customerReference
            ? String(customerReference).trim()
            : null,
          ...totalsPayload,
          lines: { create: lineCreates },
        },
        include: BASE_INCLUDE,
      });

      return created;
    });

    return NextResponse.json(normalizeSalesOrder(order), { status: 201 });
  } catch (error) {
    if (
      error?.message?.startsWith("Ligne") ||
      error?.message === "Certains comptes comptables sont introuvables."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error?.message === "Client introuvable." ||
      error?.message === "Certains produits sont introuvables."
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("POST /sales-orders error", error);
    return NextResponse.json(
      { error: error?.message || "Erreur création commande client." },
      { status: 500 }
    );
  }
}
