import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { applyOutMovement } from "@/lib/inventory";
import {
  recalcPurchaseOrderStatus,
  refreshGoodsReceiptStatus,
} from "@/app/api/goods-receipts/helpers";
import { finalizeBatchToJournal } from "@/lib/journal";

const EPS = 1e-9;

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

function toFixed(value, digits = 3) {
  return Number(value).toFixed(digits);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const purchaseOrderId = searchParams.get("purchaseOrderId");
    const q = searchParams.get("q");

    const where = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (q) where.number = { contains: q, mode: "insensitive" };

    const orders = await prisma.returnOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        goodsReceipt: { select: { id: true, number: true } },
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
          },
        },
      },
    });

    const normalized = orders.map((order) => ({
      ...order,
      issuedAt: order.issuedAt?.toISOString?.() ?? order.issuedAt,
      sentAt: order.sentAt?.toISOString?.() ?? order.sentAt,
      closedAt: order.closedAt?.toISOString?.() ?? order.closedAt,
      lines: order.lines.map((line) => ({
        ...line,
        quantity: toNumber(line.quantity),
        unitCost: toNumber(line.unitCost),
        createdAt: line.createdAt?.toISOString?.() ?? line.createdAt,
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
      })),
    }));

    return NextResponse.json({ returnOrders: normalized });
  } catch (e) {
    console.error("GET /api/return-orders error", e);
    return NextResponse.json(
      { error: "Erreur récupération retours fournisseur" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      supplierId,
      purchaseOrderId,
      goodsReceiptId,
      reason,
      notes,
      lines,
    } = body || {};

    if (!supplierId)
      return NextResponse.json({ error: "supplierId requis" }, { status: 400 });
    if (!Array.isArray(lines) || !lines.length)
      return NextResponse.json(
        { error: "Au moins une ligne requise" },
        { status: 400 }
      );
    if (lines.some((l) => !l.goodsReceiptLineId))
      return NextResponse.json(
        { error: "Chaque ligne doit référencer une ligne de réception" },
        { status: 400 }
      );

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, accountId: true, name: true },
    });
    if (!supplier)
      return NextResponse.json(
        { error: "Fournisseur introuvable" },
        { status: 404 }
      );
    if (!supplier.accountId) {
      return NextResponse.json(
        {
          error:
            "Compte comptable fournisseur manquant (configurer le compte 401).",
        },
        { status: 400 }
      );
    }

    const goodsReceiptLineIds = lines.map((l) => l.goodsReceiptLineId);
    const receiptLines = await prisma.goodsReceiptLine.findMany({
      where: { id: { in: goodsReceiptLineIds } },
      include: {
        goodsReceipt: {
          select: {
            id: true,
            supplierId: true,
            purchaseOrderId: true,
          },
        },
        product: {
          select: { id: true, name: true },
        },
        purchaseOrderLine: {
          select: {
            id: true,
            purchaseOrderId: true,
            returnedQty: true,
            orderedQty: true,
            receivedQty: true,
          },
        },
        returnOrderLines: {
          include: { returnOrder: { select: { status: true } } },
        },
        incomingInvoiceLines: {
          select: {
            id: true,
            accountId: true,
          },
        },
      },
    });

    if (receiptLines.length !== goodsReceiptLineIds.length) {
      return NextResponse.json(
        { error: "Certaines lignes de réception sont introuvables" },
        { status: 400 }
      );
    }

    const receiptLineMap = new Map(receiptLines.map((line) => [line.id, line]));

    const poIdsInLines = new Set();
    const receiptIds = new Set();

    for (const input of lines) {
      const qty = Number(input.quantity);
      if (!qty || Number.isNaN(qty) || qty <= 0)
        return NextResponse.json(
          { error: "Quantité invalide dans une ligne" },
          { status: 400 }
        );
      const line = receiptLineMap.get(input.goodsReceiptLineId);
      if (!line)
        return NextResponse.json(
          { error: "Ligne de réception introuvable" },
          { status: 400 }
        );
      if (line.goodsReceipt.supplierId !== supplierId)
        return NextResponse.json(
          { error: "Ligne de réception d'un autre fournisseur" },
          { status: 400 }
        );

      if (goodsReceiptId && line.goodsReceipt.id !== goodsReceiptId) {
        return NextResponse.json(
          { error: "Incohérence goodsReceiptId" },
          { status: 400 }
        );
      }

      const orderLine = line.purchaseOrderLine;
      if (!orderLine) {
        return NextResponse.json(
          { error: "Ligne réception sans lien BC, retour impossible" },
          { status: 400 }
        );
      }
      poIdsInLines.add(orderLine.purchaseOrderId);
      receiptIds.add(line.goodsReceipt.id);

      const existingReturns = line.returnOrderLines.filter(
        (r) => r.returnOrder?.status !== "CANCELLED"
      );
      const alreadyReturned = existingReturns.reduce(
        (acc, cur) => acc + toNumber(cur.quantity),
        0
      );
      const available = toNumber(line.qtyPutAway) - alreadyReturned;
      if (available < qty - EPS) {
        return NextResponse.json(
          {
            error: `Quantité retournée dépasse le disponible sur la réception (${line.product.name})`,
          },
          { status: 400 }
        );
      }
    }

    if (purchaseOrderId) {
      if (poIdsInLines.size > 1 || !poIdsInLines.has(purchaseOrderId)) {
        return NextResponse.json(
          { error: "Lignes retour ne correspondent pas au BC indiqué" },
          { status: 400 }
        );
      }
    }

    const inferredPurchaseOrderId = purchaseOrderId || [...poIdsInLines][0];

    function resolveReturnAccount(goodsReceiptLine) {
      const candidateAccounts = (goodsReceiptLine.incomingInvoiceLines || [])
        .map((invLine) => invLine.accountId)
        .filter(Boolean);

      if (!candidateAccounts.length) {
        throw new Error(
          `Impossible de déterminer le compte d'achat pour la ligne de réception ${goodsReceiptLine.id}. Rattachez-la à une ligne de facture fournisseur comportant le compte 601 concerné.`
        );
      }

      const uniqueAccounts = new Set(candidateAccounts);
      if (uniqueAccounts.size > 1) {
        throw new Error(
          `Plusieurs comptes d'achat différents trouvés pour la ligne de réception ${goodsReceiptLine.id}. Vérifiez la facture fournisseur liée.`
        );
      }

      return candidateAccounts[0];
    }

    const createdId = await prisma.$transaction(async (tx) => {
      const number = await nextSequence(tx, "RETURN_ORDER", "RO-");
      const order = await tx.returnOrder.create({
        data: {
          number,
          status: "DRAFT",
          supplier: { connect: { id: supplierId } },
          purchaseOrder: inferredPurchaseOrderId
            ? { connect: { id: inferredPurchaseOrderId } }
            : undefined,
          goodsReceipt:
            receiptIds.size === 1
              ? { connect: { id: [...receiptIds][0] } }
              : undefined,
          reason: reason ? String(reason).trim() : null,
          notes: notes ? String(notes).trim() : null,
        },
      });

      const affectedGoodsReceiptIds = new Set();
      const accountSummaries = new Map();
      let totalReturnAmount = 0;

      for (const input of lines) {
        const qty = Number(input.quantity);
        const line = receiptLineMap.get(input.goodsReceiptLineId);
        const orderLine = line.purchaseOrderLine;
        const productId = line.productId;
        affectedGoodsReceiptIds.add(line.goodsReceipt.id);

        const rawUnitCost =
          input.unitCost != null
            ? Number(input.unitCost)
            : toNumber(line.unitCost);
        const unitCost = Number.isFinite(rawUnitCost) ? rawUnitCost : 0;

        const returnLine = await tx.returnOrderLine.create({
          data: {
            returnOrderId: order.id,
            productId,
            goodsReceiptLineId: line.id,
            purchaseOrderLineId: orderLine.id,
            quantity: qty.toFixed(3),
            unitCost: unitCost.toFixed(4),
            reason: input.reason ? String(input.reason).trim() : null,
          },
        });

        const outResult = await applyOutMovement(tx, {
          productId,
          qty,
        });
        const unitCostOut = Number.isFinite(outResult.unitCost)
          ? outResult.unitCost
          : unitCost;
        const totalCost = Number((unitCostOut * qty).toFixed(2));

        await tx.stockMovement.create({
          data: {
            productId,
            movementType: "OUT",
            stage: "AVAILABLE",
            quantity: qty.toFixed(3),
            unitCost: unitCostOut.toFixed(4),
            totalCost: totalCost.toFixed(2),
            returnOrderLineId: returnLine.id,
          },
        });

        const accountIdForLine = resolveReturnAccount(line);
        const currentSummary = accountSummaries.get(accountIdForLine) || {
          amount: 0,
          products: new Set(),
        };
        currentSummary.amount = Number(
          (currentSummary.amount + totalCost).toFixed(2)
        );
        if (line.product?.name) {
          currentSummary.products.add(line.product.name);
        }
        accountSummaries.set(accountIdForLine, currentSummary);
        totalReturnAmount = Number((totalReturnAmount + totalCost).toFixed(2));

        const currentReturned = toNumber(orderLine.returnedQty);
        await tx.purchaseOrderLine.update({
          where: { id: orderLine.id },
          data: { returnedQty: (currentReturned + qty).toFixed(3) },
        });
      }

      if (inferredPurchaseOrderId) {
        await recalcPurchaseOrderStatus(
          tx,
          inferredPurchaseOrderId,
          "Retour fournisseur créé"
        );
      }
      for (const id of affectedGoodsReceiptIds) {
        await refreshGoodsReceiptStatus(tx, id);
      }

      if (accountSummaries.size) {
        const transactions = [];
        for (const [accountId, summary] of accountSummaries.entries()) {
          if (!summary.amount || summary.amount <= 0) continue;
          const descriptionParts = ["Retour fournisseur", order.number];
          if (summary.products.size) {
            descriptionParts.push(`(${[...summary.products].join(", ")})`);
          }
          const ledgerTx = await tx.transaction.create({
            data: {
              date: new Date(),
              nature: "purchase",
              description: descriptionParts.join(" "),
              amount: summary.amount.toFixed(2),
              direction: "CREDIT",
              kind: "PURCHASE_RETURN",
              accountId,
              supplierId,
              returnOrderId: order.id,
            },
          });
          transactions.push(ledgerTx);
        }

        const payableTx = await tx.transaction.create({
          data: {
            date: new Date(),
            nature: "purchase",
            description: `Avoir à recevoir ${order.number}`,
            amount: totalReturnAmount.toFixed(2),
            direction: "DEBIT",
            kind: "PAYABLE",
            accountId: supplier.accountId,
            supplierId,
            returnOrderId: order.id,
          },
        });
        transactions.push(payableTx);

        await finalizeBatchToJournal(tx, {
          sourceType: "RETURN_ORDER",
          sourceId: order.id,
          date: new Date(),
          description: `Retour fournisseur ${order.number}`,
          transactions,
        });
      }

      return order.id;
    });

    const full = await prisma.returnOrder.findUnique({
      where: { id: createdId },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        goodsReceipt: { select: { id: true, number: true } },
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
          },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error("POST /api/return-orders error", e);
    return NextResponse.json(
      { error: e.message || "Erreur création retour fournisseur" },
      { status: 500 }
    );
  }
}
