import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { applyInMovement } from "@/lib/inventory";
import {
  refreshGoodsReceiptStatus,
  recalcPurchaseOrderStatus,
} from "./helpers";

// GET /api/goods-receipts?status=&supplierId=&purchaseOrderId=&q=
export async function GET(request) {
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
  try {
    const receipts = await prisma.goodsReceipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        supplier: true,
        purchaseOrder: true,
        lines: { include: { product: true, purchaseOrderLine: true } },
      },
    });
    return NextResponse.json(receipts);
  } catch (e) {
    console.error("GET /goods-receipts error", e);
    return NextResponse.json(
      { error: "Erreur récupération réceptions." },
      { status: 500 }
    );
  }
}

// POST /api/goods-receipts
// { supplierId?, purchaseOrderId?, lines:[{ productId, qtyReceived, unitCost, purchaseOrderLineId? }] }
export async function POST(request) {
  try {
    const body = await request.json();
    const { supplierId, purchaseOrderId, lines } = body;
    if (!supplierId && !purchaseOrderId) {
      return NextResponse.json(
        { error: "supplierId requis si aucun purchaseOrderId." },
        { status: 400 }
      );
    }
    if (!Array.isArray(lines) || !lines.length)
      return NextResponse.json({ error: "lines requises." }, { status: 400 });

    const normLines = lines.map((l, idx) => {
      const productId = l.productId;
      const qty = Number(l.qtyReceived);
      const unitCost = Number(l.unitCost);
      if (
        !productId ||
        Number.isNaN(qty) ||
        qty === 0 ||
        Number.isNaN(unitCost) ||
        unitCost < 0
      ) {
        throw new Error(`Ligne ${idx + 1} invalide.`);
      }
      return {
        rawPurchaseOrderLineId: l.purchaseOrderLineId || null,
        data: {
          productId,
          qtyReceived: qty.toString(),
          unitCost: unitCost.toString(),
          qtyPutAway: "0",
          status: "QC_PENDING",
          purchaseOrderLineId: l.purchaseOrderLineId || undefined,
        },
        qty,
        unitCost,
        expectedVersion: l.version != null ? Number(l.version) : null,
      };
    });

    const tolerancePct = process.env.PO_OVER_RECEIPT_TOLERANCE_PCT
      ? Number(process.env.PO_OVER_RECEIPT_TOLERANCE_PCT)
      : 0;
    if (isNaN(tolerancePct) || tolerancePct < 0) {
      console.warn("PO_OVER_RECEIPT_TOLERANCE_PCT invalide, fallback 0");
    }

    const receiptId = await prisma.$transaction(async (tx) => {
      // Validate purchase order if provided
      let po = null;
      if (purchaseOrderId) {
        po = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { lines: true },
        });
        if (!po) throw new Error("PurchaseOrder introuvable.");
      }
      const effectiveSupplierId = supplierId || po?.supplierId || undefined;

      // Over-receipt validation
      for (const l of normLines) {
        if (l.rawPurchaseOrderLineId) {
          const pol = po?.lines.find(
            (pl) => pl.id === l.rawPurchaseOrderLineId
          );
          if (!pol) throw new Error("purchaseOrderLineId invalide.");
          const ordered = Number(pol.orderedQty);
          const currentReceived = Number(pol.receivedQty);
          const newReceived = currentReceived + l.qty;
          if (newReceived < -1e-9) {
            throw new Error(
              "Réception négative dépasse les quantités déjà réceptionnées."
            );
          }
          const allowed = ordered * (1 + tolerancePct / 100);
          if (newReceived - allowed > 1e-9) {
            throw new Error(
              `Réception excédant la quantité commandée (tolérance ${tolerancePct}%).`
            );
          }
          if (l.expectedVersion != null && pol.version !== l.expectedVersion) {
            const concurrencyInfo = `version attendue ${l.expectedVersion}, actuelle ${pol.version}`;
            const err = new Error(
              "Conflit de version réception. " + concurrencyInfo
            );
            err.code = "CONFLICT_VERSION";
            throw err;
          }
        }
      }

      const number = await nextSequence(tx, "GR", "GR-");
      const gr = await tx.goodsReceipt.create({
        data: {
          number,
          supplierId: effectiveSupplierId,
          purchaseOrderId: purchaseOrderId || undefined,
          lines: { create: normLines.map((n) => n.data) },
        },
        include: { lines: true },
      });

      // Create stock movements for each line & update inventory (CUMP)
      for (const line of gr.lines) {
        const qtyNum = Number(line.qtyReceived);
        const unitCostNum = Number(line.unitCost);
        await applyInMovement(tx, {
          productId: line.productId,
          qty: qtyNum,
          unitCost: unitCostNum,
          stage: "STAGED",
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            movementType: qtyNum >= 0 ? "IN" : "ADJUST",
            stage: "STAGED",
            quantity: line.qtyReceived,
            unitCost: unitCostNum.toFixed(4),
            totalCost: (qtyNum * unitCostNum).toFixed(2),
            goodsReceiptLineId: line.id,
          },
        });
        if (line.purchaseOrderLineId) {
          const normOriginal = normLines.find(
            (n) => n.data.purchaseOrderLineId === line.purchaseOrderLineId
          );
          // Lecture actuelle (sans champ version si non défini dans le client Prisma actuel)
          const currentPOL = await tx.purchaseOrderLine.findUnique({
            where: { id: line.purchaseOrderLineId },
            select: { id: true, orderedQty: true, receivedQty: true }, // version retiré (schema/client ne l'expose pas)
          });
          if (!currentPOL) throw new Error("purchaseOrderLine introuvable.");
          if (normOriginal?.expectedVersion != null) {
            // Avertir côté serveur si on a reçu une version mais qu'on ne peut pas la vérifier
            console.warn(
              "[GR] Version reçue (" +
                normOriginal.expectedVersion +
                ") ignorée: champ version absent du client Prisma."
            );
          }
          const ordered = Number(currentPOL.orderedQty);
          const currentReceived = Number(currentPOL.receivedQty);
          const newReceived = currentReceived + Number(line.qtyReceived);
          if (newReceived < -1e-9) {
            throw new Error(
              "Course condition: correction dépasse les quantités réceptionnées."
            );
          }
          const allowed = ordered * (1 + tolerancePct / 100);
          if (newReceived - allowed > 1e-9) {
            throw new Error(
              "Réception dépasse la quantité autorisée après recalcul."
            );
          }
          const updated = await tx.purchaseOrderLine.update({
            where: { id: currentPOL.id },
            data: { receivedQty: newReceived.toFixed(3) },
            select: {
              id: true,
              orderedQty: true,
              receivedQty: true,
              billedQty: true,
            },
          });
          if (Number(updated.receivedQty) - allowed > 1e-9) {
            throw new Error("Course condition: dépassement après mise à jour.");
          }
        }
      }

      await refreshGoodsReceiptStatus(tx, gr.id);
      if (po) {
        await recalcPurchaseOrderStatus(
          tx,
          po.id,
          "Mise à jour suite réception"
        );
      }
      return gr.id;
    });
    const full = await prisma.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: {
        supplier: true,
        purchaseOrder: true,
        lines: { include: { product: true, purchaseOrderLine: true } },
      },
    });
    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error("POST /goods-receipts error", e);
    if (e.message?.includes("Réception excédant"))
      return NextResponse.json({ error: e.message }, { status: 400 });
    if (e.message?.includes("invalide"))
      return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json(
      { error: "Erreur création réception." },
      { status: 500 }
    );
  }
}
