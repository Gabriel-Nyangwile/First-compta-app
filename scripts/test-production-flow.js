#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import prisma from "../src/lib/prisma.js";
import { applyInMovement } from "../src/lib/inventory.js";
import {
  cancelOrder,
  closeOrder,
  completeOrder,
  consumeOrder,
  createBom,
  createOrder,
  releaseOrder,
  setBomStatus,
} from "../src/lib/production.js";

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function cleanup(companyId) {
  if (!companyId) return;
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.transaction.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.manufacturingOutput.deleteMany({ where: { companyId } });
  await prisma.manufacturingOrderComponent.deleteMany({ where: { companyId } });
  await prisma.manufacturingOrder.deleteMany({ where: { companyId } });
  await prisma.billOfMaterialLine.deleteMany({ where: { companyId } });
  await prisma.billOfMaterial.deleteMany({ where: { companyId } });
  await prisma.productInventory.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.sequence.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => null);
}

async function createFixtures(runId) {
  const company = await prisma.company.create({
    data: {
      name: `PRODUCTION TEST ${runId}`,
      currency: "XOF",
      fiscalYearStart: "01-01",
    },
    select: { id: true },
  });

  const [stockRaw, stockFinished, purchaseVariation, productionVariation, wip] =
    await Promise.all([
      prisma.account.create({ data: { companyId: company.id, number: "310101", label: "Stock composants test" } }),
      prisma.account.create({ data: { companyId: company.id, number: "350101", label: "Stock produits finis test" } }),
      prisma.account.create({ data: { companyId: company.id, number: "603101", label: "Variation composants test" } }),
      prisma.account.create({ data: { companyId: company.id, number: "701101", label: "Production stockée test" } }),
      prisma.account.create({ data: { companyId: company.id, number: "331001", label: "Production en cours test" } }),
    ]);

  const component = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: `COMP-${runId}`,
      name: "Composant production test",
      unit: "PCS",
      inventoryAccountId: stockRaw.id,
      stockVariationAccountId: purchaseVariation.id,
    },
  });
  const finished = await prisma.product.create({
    data: {
      companyId: company.id,
      sku: `FIN-${runId}`,
      name: "Produit fini production test",
      unit: "PCS",
      stockNature: "PRODUCED",
      inventoryAccountId: stockFinished.id,
      stockVariationAccountId: productionVariation.id,
    },
  });

  await prisma.$transaction(async (tx) => {
    await applyInMovement(tx, {
      productId: component.id,
      qty: 10,
      unitCost: 5,
      companyId: company.id,
    });
    await tx.stockMovement.create({
      data: {
        companyId: company.id,
        productId: component.id,
        movementType: "IN",
        quantity: "10.000",
        unitCost: "5.0000",
        totalCost: "50.00",
      },
    });
  });

  return { company, component, finished, wip };
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  let companyId = null;
  try {
    const fixtures = await createFixtures(runId);
    companyId = fixtures.company.id;

    const bom = await createBom({
      companyId,
      body: {
        label: "Nomenclature production test",
        productId: fixtures.finished.id,
        lines: [{ componentProductId: fixtures.component.id, quantity: 2, lossRate: 0 }],
      },
    });
    await setBomStatus({ id: bom.id, companyId, status: "ACTIVE" });

    const order = await createOrder({
      companyId,
      body: {
        billOfMaterialId: bom.id,
        plannedQty: 3,
        wipAccountId: fixtures.wip.id,
      },
    });
    assert(order.number.startsWith("MO-"), "Numérotation MO attendue.", order);
    assert(order.components.length === 1, "Composant d'ordre attendu.", order.components);
    assert(order.components[0].plannedQty === 6, "Quantité composant prévue incohérente.", order.components[0]);

    await releaseOrder({ id: order.id, companyId });
    await consumeOrder({ id: order.id, companyId });
    await completeOrder({ id: order.id, companyId, body: { quantity: 3, scrapQty: 0 } });
    await closeOrder({ id: order.id, companyId });

    const [componentInv, finishedInv, closedOrder, journals, transactions] = await Promise.all([
      prisma.productInventory.findUnique({ where: { productId: fixtures.component.id } }),
      prisma.productInventory.findUnique({ where: { productId: fixtures.finished.id } }),
      prisma.manufacturingOrder.findUnique({ where: { id: order.id }, include: { outputs: true } }),
      prisma.journalEntry.findMany({ where: { companyId, sourceType: "MANUFACTURING_ORDER" } }),
      prisma.transaction.findMany({ where: { companyId }, include: { journalEntry: true } }),
    ]);

    assert(Number(componentInv.qtyOnHand) === 4, "Stock composant après consommation incohérent.", componentInv);
    assert(Number(finishedInv.qtyOnHand) === 3, "Stock produit fini incohérent.", finishedInv);
    assert(closedOrder.status === "CLOSED", "Ordre non clôturé.", closedOrder);
    assert(closedOrder.outputs.length === 1, "Déclaration de production manquante.", closedOrder.outputs);
    assert(journals.length === 2, "Deux journaux production attendus.", journals);

    const debit = transactions
      .filter((transaction) => transaction.direction === "DEBIT")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const credit = transactions
      .filter((transaction) => transaction.direction === "CREDIT")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    assert(Math.abs(debit - credit) < 0.01, "Transactions production non équilibrées.", { debit, credit });

    const cancelled = await createOrder({
      companyId,
      body: {
        billOfMaterialId: bom.id,
        plannedQty: 1,
        wipAccountId: fixtures.wip.id,
      },
    });
    const cancelledOrder = await cancelOrder({ id: cancelled.id, companyId });
    assert(cancelledOrder.status === "CANCELLED", "Annulation ordre DRAFT attendue.", cancelledOrder);

    console.log("Production flow smoke OK");
  } finally {
    await cleanup(companyId);
  }
}

main()
  .catch((error) => {
    console.error("test-production-flow error:", error.message || error);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
