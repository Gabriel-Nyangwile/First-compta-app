#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";
import { nextSequence } from "../src/lib/sequence.js";

const EPSILON = 1e-9;

const fmtQty = (value) => Number(value).toFixed(3);
const fmtCost = (value) => Number(value).toFixed(4);
const fmtAmount = (value) => Number(value).toFixed(2);

async function ensureInventory(client, productId) {
  return client.productInventory.upsert({
    where: { productId },
    update: {},
    create: { productId, qtyOnHand: "0", qtyStaged: "0", avgCost: null },
  });
}

async function applyIn(client, { productId, qty, unitCost }) {
  if (!qty || Number.isNaN(qty)) throw new Error("qty invalide");
  if (unitCost == null || Number.isNaN(unitCost))
    throw new Error("unitCost invalide");
  const inv = await ensureInventory(client, productId);
  const currentQty = Number(inv.qtyOnHand);
  const currentAvg = inv.avgCost != null ? Number(inv.avgCost) : null;

  let newAvg;
  if (currentQty <= EPSILON || currentAvg == null) {
    newAvg = unitCost;
  } else {
    const totalPrevCost = currentQty * currentAvg;
    const totalIncomingCost = qty * unitCost;
    newAvg = (totalPrevCost + totalIncomingCost) / (currentQty + qty);
  }

  const updated = await client.productInventory.update({
    where: { productId },
    data: {
      qtyOnHand: fmtQty(currentQty + qty),
      avgCost: newAvg != null ? fmtCost(newAvg) : null,
    },
  });

  return { inventory: updated, avgCost: newAvg };
}

async function applyOut(client, { productId, qty }) {
  if (!qty || Number.isNaN(qty)) throw new Error("qty invalide");
  const inv = await ensureInventory(client, productId);
  const prevQty = Number(inv.qtyOnHand);
  const avg = inv.avgCost != null ? Number(inv.avgCost) : 0;
  if (qty > prevQty + EPSILON) {
    throw new Error("Stock insuffisant pour sortie.");
  }
  const updated = await client.productInventory.update({
    where: { productId },
    data: { qtyOnHand: fmtQty(prevQty - qty) },
  });
  return { unitCost: avg, totalCost: avg * qty, inventory: updated };
}

async function seedSupplier() {
  const existing = await prisma.supplier.findFirst();
  if (existing) return existing;
  return prisma.supplier.create({
    data: { name: `Fournisseur test ${Date.now()}` },
  });
}

async function createProduct() {
  const suffix = Date.now();
  return prisma.product.create({
    data: {
      sku: `INV-${suffix}`,
      name: `Article inventaire test ${suffix}`,
    },
  });
}

async function createPurchaseAndReceipt({
  productId,
  supplierId,
  qty,
  unitCost,
}) {
  return prisma.$transaction(async (tx) => {
    const poNumber = await nextSequence(tx, "PO", "PO-");
    const po = await tx.purchaseOrder.create({
      data: {
        number: poNumber,
        supplierId,
        status: "APPROVED",
      },
    });

    const poLine = await tx.purchaseOrderLine.create({
      data: {
        purchaseOrderId: po.id,
        productId,
        orderedQty: fmtQty(qty),
        unitPrice: fmtCost(unitCost),
      },
    });

    const grNumber = await nextSequence(tx, "GR", "GR-");
    const gr = await tx.goodsReceipt.create({
      data: {
        number: grNumber,
        supplierId,
        purchaseOrderId: po.id,
        status: "PUTAWAY_DONE",
      },
    });

    const grLine = await tx.goodsReceiptLine.create({
      data: {
        goodsReceiptId: gr.id,
        purchaseOrderLineId: poLine.id,
        productId,
        qtyReceived: fmtQty(qty),
        qtyPutAway: fmtQty(qty),
        unitCost: fmtCost(unitCost),
        status: "PUTAWAY_DONE",
        qcStatus: "ACCEPTED",
      },
    });

    await tx.purchaseOrderLine.update({
      where: { id: poLine.id },
      data: { receivedQty: fmtQty(qty) },
    });

    await applyIn(tx, { productId, qty, unitCost });
    await tx.stockMovement.create({
      data: {
        productId,
        movementType: "IN",
        stage: "AVAILABLE",
        quantity: fmtQty(qty),
        unitCost: fmtCost(unitCost),
        totalCost: fmtAmount(unitCost * qty),
        goodsReceiptLineId: grLine.id,
      },
    });

    return { po, poLine, gr, grLine };
  });
}

async function recordSale({ productId, qty }) {
  return prisma.$transaction(async (tx) => {
    const outResult = await applyOut(tx, { productId, qty });
    const unitCost = Number.isFinite(outResult.unitCost)
      ? outResult.unitCost
      : 0;
    await tx.stockMovement.create({
      data: {
        productId,
        movementType: "OUT",
        stage: "AVAILABLE",
        quantity: fmtQty(qty),
        unitCost: fmtCost(unitCost),
        totalCost: fmtAmount(unitCost * qty),
      },
    });
    return outResult;
  });
}

async function createReturn({
  supplierId,
  purchaseOrderId,
  goodsReceiptId,
  goodsReceiptLineId,
  purchaseOrderLineId,
  productId,
  qty,
  unitCost,
}) {
  return prisma.$transaction(async (tx) => {
    const roNumber = await nextSequence(tx, "RETURN_ORDER", "RO-");
    const order = await tx.returnOrder.create({
      data: {
        number: roNumber,
        status: "DRAFT",
        supplierId,
        purchaseOrderId,
        goodsReceiptId,
        reason: "Test flux inventaire",
      },
    });

    const line = await tx.returnOrderLine.create({
      data: {
        returnOrderId: order.id,
        productId,
        goodsReceiptLineId,
        purchaseOrderLineId,
        quantity: fmtQty(qty),
        unitCost: fmtCost(unitCost),
        reason: "Script de test",
      },
    });

    const outResult = await applyOut(tx, { productId, qty });
    const unitCostUsed = Number.isFinite(outResult.unitCost)
      ? outResult.unitCost
      : unitCost;
    const totalCost = unitCostUsed * qty;

    await tx.stockMovement.create({
      data: {
        productId,
        movementType: "OUT",
        stage: "AVAILABLE",
        quantity: fmtQty(qty),
        unitCost: fmtCost(unitCostUsed),
        totalCost: fmtAmount(totalCost),
        returnOrderLineId: line.id,
      },
    });

    const currentLine = await tx.purchaseOrderLine.findUnique({
      where: { id: purchaseOrderLineId },
      select: { returnedQty: true },
    });
    const currentReturned = Number(currentLine?.returnedQty ?? 0);
    await tx.purchaseOrderLine.update({
      where: { id: purchaseOrderLineId },
      data: { returnedQty: fmtQty(currentReturned + qty) },
    });

    return { order, line, unitCost: unitCostUsed, totalCost };
  });
}

async function main() {
  console.log("--- Test de flux d'inventaire ---");
  const supplier = await seedSupplier();
  const product = await createProduct();
  console.log("Produit créé", product.sku);

  const qtyReceived = 10;
  const unitCost = 5;
  const saleQty = 4;
  const returnQty = 2;

  const { po, poLine, gr, grLine } = await createPurchaseAndReceipt({
    productId: product.id,
    supplierId: supplier.id,
    qty: qtyReceived,
    unitCost,
  });
  console.log(`Réception de ${qtyReceived} unités à ${unitCost}`);

  const invAfterReceipt = await prisma.productInventory.findUnique({
    where: { productId: product.id },
  });
  if (Number(invAfterReceipt?.qtyOnHand ?? 0) !== qtyReceived) {
    throw new Error(
      `Quantité de stock incohérente après réception, attendu ${qtyReceived} obtenu ${invAfterReceipt?.qtyOnHand}`
    );
  }

  await recordSale({ productId: product.id, qty: saleQty });
  console.log(`Vente de ${saleQty} unités`);

  const invAfterSale = await prisma.productInventory.findUnique({
    where: { productId: product.id },
  });
  if (Number(invAfterSale?.qtyOnHand ?? 0) !== qtyReceived - saleQty) {
    throw new Error(
      `Quantité de stock incohérente après vente, attendu ${
        qtyReceived - saleQty
      } obtenu ${invAfterSale?.qtyOnHand}`
    );
  }

  await createReturn({
    supplierId: supplier.id,
    purchaseOrderId: po.id,
    goodsReceiptId: gr.id,
    goodsReceiptLineId: grLine.id,
    purchaseOrderLineId: poLine.id,
    productId: product.id,
    qty: returnQty,
    unitCost,
  });
  console.log(`Retour de ${returnQty} unités au fournisseur`);

  const finalInventory = await prisma.productInventory.findUnique({
    where: { productId: product.id },
  });
  const expectedFinalQty = qtyReceived - saleQty - returnQty;
  if (Number(finalInventory?.qtyOnHand ?? 0) !== expectedFinalQty) {
    throw new Error(
      `Quantité de stock incohérente après retour, attendu ${expectedFinalQty} obtenu ${finalInventory?.qtyOnHand}`
    );
  }
  if (
    finalInventory?.avgCost != null &&
    Math.abs(Number(finalInventory.avgCost) - unitCost) > EPSILON
  ) {
    throw new Error(
      `Coût moyen décalé, attendu ${unitCost} obtenu ${finalInventory.avgCost}`
    );
  }

  const poLineFinal = await prisma.purchaseOrderLine.findUnique({
    where: { id: poLine.id },
  });
  if (Number(poLineFinal?.returnedQty ?? 0) !== returnQty) {
    throw new Error(
      `Quantité retournée incohérente sur la ligne de BC, attendu ${returnQty} obtenu ${poLineFinal?.returnedQty}`
    );
  }

  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "asc" },
  });
  if (movements.length !== 3) {
    throw new Error(
      `3 mouvements de stock attendus (ENTRÉE, SORTIE, RETOUR) mais ${movements.length} trouvé(s)`
    );
  }
  const hasReturnLink = movements.some((m) => m.returnOrderLineId != null);
  if (!hasReturnLink) {
    throw new Error("Aucun mouvement de stock lié à la ligne de retour");
  }

  console.log("Test de flux d'inventaire OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
