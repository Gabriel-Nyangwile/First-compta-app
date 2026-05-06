import prisma from "./prisma.js";
import { nextSequence } from "./sequence.js";
import { applyInMovement, applyOutMovement } from "./inventory.js";
import { finalizeBatchToJournal } from "./journal.js";

const EPSILON = 1e-9;

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

function asDecimalString(value, digits = 3) {
  return Number(value).toFixed(digits);
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function serializeProduct(product) {
  if (!product) return null;
  return {
    ...product,
    inventory: product.inventory
      ? {
          ...product.inventory,
          qtyOnHand: toNumber(product.inventory.qtyOnHand),
          qtyStaged: toNumber(product.inventory.qtyStaged),
          avgCost: product.inventory.avgCost == null ? null : toNumber(product.inventory.avgCost),
        }
      : null,
  };
}

export function serializeBom(bom) {
  if (!bom) return null;
  return {
    ...bom,
    product: serializeProduct(bom.product),
    lines: (bom.lines || []).map((line) => ({
      ...line,
      quantity: toNumber(line.quantity),
      lossRate: toNumber(line.lossRate),
      componentProduct: serializeProduct(line.componentProduct),
    })),
  };
}

export function serializeOrder(order) {
  if (!order) return null;
  return {
    ...order,
    plannedQty: toNumber(order.plannedQty),
    producedQty: toNumber(order.producedQty),
    scrapQty: toNumber(order.scrapQty),
    product: serializeProduct(order.product),
    billOfMaterial: serializeBom(order.billOfMaterial),
    components: (order.components || []).map((component) => ({
      ...component,
      plannedQty: toNumber(component.plannedQty),
      consumedQty: toNumber(component.consumedQty),
      varianceQty: toNumber(component.varianceQty),
      product: serializeProduct(component.product),
    })),
    outputs: (order.outputs || []).map((output) => ({
      ...output,
      quantity: toNumber(output.quantity),
      unitCost: toNumber(output.unitCost),
      product: serializeProduct(output.product),
    })),
  };
}

const bomInclude = {
  product: { include: { inventory: true, inventoryAccount: true, stockVariationAccount: true } },
  lines: {
    orderBy: { createdAt: "asc" },
    include: {
      componentProduct: {
        include: { inventory: true, inventoryAccount: true, stockVariationAccount: true },
      },
    },
  },
};

const orderInclude = {
  product: { include: { inventory: true, inventoryAccount: true, stockVariationAccount: true } },
  wipAccount: true,
  billOfMaterial: { include: bomInclude },
  components: {
    orderBy: { createdAt: "asc" },
    include: {
      product: { include: { inventory: true, inventoryAccount: true, stockVariationAccount: true } },
    },
  },
  outputs: {
    orderBy: { declaredAt: "desc" },
    include: { product: { include: { inventory: true } } },
  },
};

async function requireProducts(client, companyId, productIds) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const products = await client.product.findMany({
    where: { companyId, id: { in: uniqueIds } },
    select: { id: true },
  });
  if (products.length !== uniqueIds.length) {
    throw new Error("Produit introuvable dans la société courante.");
  }
}

async function requireAccount(client, companyId, accountId, label = "Compte") {
  const account = await client.account.findFirst({
    where: { id: accountId, companyId },
    select: { id: true, number: true, label: true },
  });
  if (!account) throw new Error(`${label} introuvable.`);
  return account;
}

function normalizeBomLines(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error("Au moins un composant de nomenclature est requis.");
  }
  return lines.map((line, index) => {
    const componentProductId = String(line.componentProductId || line.productId || "").trim();
    const quantity = Number(line.quantity);
    const lossRate = line.lossRate == null || line.lossRate === "" ? 0 : Number(line.lossRate);
    if (!componentProductId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Composant ${index + 1}: produit et quantité positive requis.`);
    }
    if (!Number.isFinite(lossRate) || lossRate < 0 || lossRate >= 1) {
      throw new Error(`Composant ${index + 1}: taux de perte invalide.`);
    }
    return {
      componentProductId,
      quantity,
      lossRate,
      notes: line.notes ? String(line.notes).trim() : null,
    };
  });
}

export async function listBoms({ companyId, status = null, q = null }) {
  const where = { companyId };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { label: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
      { product: { sku: { contains: q, mode: "insensitive" } } },
    ];
  }
  const boms = await prisma.billOfMaterial.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: bomInclude,
  });
  return boms.map(serializeBom);
}

export async function getBom({ id, companyId }) {
  const bom = await prisma.billOfMaterial.findFirst({
    where: { id, companyId },
    include: bomInclude,
  });
  return serializeBom(bom);
}

export async function createBom({ companyId, body }) {
  const productId = String(body.productId || "").trim();
  const label = String(body.label || "").trim();
  const version = Number.parseInt(body.version || "1", 10) || 1;
  const lines = normalizeBomLines(body.lines);
  if (!productId || !label) throw new Error("Produit fini et libellé requis.");

  return prisma.$transaction(async (tx) => {
    await requireProducts(tx, companyId, [productId, ...lines.map((line) => line.componentProductId)]);
    const code = String(body.code || "").trim() || await nextSequence(tx, "BOM", "BOM-", companyId);
    const bom = await tx.billOfMaterial.create({
      data: {
        companyId,
        code,
        label,
        productId,
        version,
        notes: body.notes ? String(body.notes).trim() : null,
        lines: {
          create: lines.map((line) => ({
            companyId,
            componentProductId: line.componentProductId,
            quantity: asDecimalString(line.quantity),
            lossRate: Number(line.lossRate).toFixed(4),
            notes: line.notes,
          })),
        },
      },
      include: bomInclude,
    });
    return serializeBom(bom);
  });
}

export async function updateBom({ id, companyId, body }) {
  const existing = await prisma.billOfMaterial.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Nomenclature introuvable.");
  if (existing.status === "ARCHIVED") throw new Error("Nomenclature archivée non modifiable.");

  const productId = String(body.productId || existing.productId || "").trim();
  const label = String(body.label || existing.label || "").trim();
  const lines = body.lines ? normalizeBomLines(body.lines) : null;

  return prisma.$transaction(async (tx) => {
    if (lines) {
      await requireProducts(tx, companyId, [productId, ...lines.map((line) => line.componentProductId)]);
      await tx.billOfMaterialLine.deleteMany({ where: { billOfMaterialId: id, companyId } });
    } else {
      await requireProducts(tx, companyId, [productId]);
    }

    const bom = await tx.billOfMaterial.update({
      where: { id },
      data: {
        label,
        productId,
        version: body.version ? Number.parseInt(body.version, 10) || existing.version : existing.version,
        notes: body.notes == null ? existing.notes : String(body.notes).trim(),
        ...(lines
          ? {
              lines: {
                create: lines.map((line) => ({
                  companyId,
                  componentProductId: line.componentProductId,
                  quantity: asDecimalString(line.quantity),
                  lossRate: Number(line.lossRate).toFixed(4),
                  notes: line.notes,
                })),
              },
            }
          : {}),
      },
      include: bomInclude,
    });
    return serializeBom(bom);
  });
}

export async function setBomStatus({ id, companyId, status }) {
  const existing = await prisma.billOfMaterial.findFirst({ where: { id, companyId }, select: { id: true } });
  if (!existing) throw new Error("Nomenclature introuvable.");
  const bom = await prisma.billOfMaterial.update({
    where: { id },
    data: { status },
    include: bomInclude,
  });
  return serializeBom(bom);
}

export async function listOrders({ companyId, status = null, q = null }) {
  const where = { companyId };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { product: { name: { contains: q, mode: "insensitive" } } },
      { product: { sku: { contains: q, mode: "insensitive" } } },
    ];
  }
  const orders = await prisma.manufacturingOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: orderInclude,
  });
  return orders.map(serializeOrder);
}

export async function getOrder({ id, companyId }) {
  const order = await prisma.manufacturingOrder.findFirst({
    where: { id, companyId },
    include: orderInclude,
  });
  return serializeOrder(order);
}

export async function createOrder({ companyId, userId = null, body }) {
  const billOfMaterialId = String(body.billOfMaterialId || "").trim();
  const plannedQty = Number(body.plannedQty);
  const wipAccountId = String(body.wipAccountId || "").trim();
  if (!billOfMaterialId || !Number.isFinite(plannedQty) || plannedQty <= 0 || !wipAccountId) {
    throw new Error("Nomenclature, quantité prévue et compte de production en cours requis.");
  }

  return prisma.$transaction(async (tx) => {
    const bom = await tx.billOfMaterial.findFirst({
      where: { id: billOfMaterialId, companyId },
      include: { lines: true },
    });
    if (!bom) throw new Error("Nomenclature introuvable.");
    if (bom.status !== "ACTIVE") throw new Error("La nomenclature doit être active pour créer un ordre.");
    await requireAccount(tx, companyId, wipAccountId, "Compte de production en cours");
    if (!bom.lines.length) throw new Error("Nomenclature sans composant.");

    const number = await nextSequence(tx, "MO", "MO-", companyId);
    const order = await tx.manufacturingOrder.create({
      data: {
        companyId,
        number,
        billOfMaterialId: bom.id,
        productId: bom.productId,
        plannedQty: asDecimalString(plannedQty),
        wipAccountId,
        plannedDate: normalizeDate(body.plannedDate),
        notes: body.notes ? String(body.notes).trim() : null,
        createdById: userId || null,
        components: {
          create: bom.lines.map((line) => {
            const baseQty = toNumber(line.quantity) * plannedQty;
            const plannedComponentQty = baseQty * (1 + toNumber(line.lossRate));
            return {
              companyId,
              productId: line.componentProductId,
              plannedQty: asDecimalString(plannedComponentQty),
            };
          }),
        },
      },
      include: orderInclude,
    });
    return serializeOrder(order);
  });
}

export async function updateOrder({ id, companyId, body }) {
  const existing = await prisma.manufacturingOrder.findFirst({ where: { id, companyId } });
  if (!existing) throw new Error("Ordre de fabrication introuvable.");
  if (existing.status !== "DRAFT") throw new Error("Seul un ordre brouillon est modifiable.");

  const data = {};
  if (body.plannedDate !== undefined) data.plannedDate = normalizeDate(body.plannedDate);
  if (body.notes !== undefined) data.notes = String(body.notes || "").trim() || null;
  if (body.wipAccountId) {
    await requireAccount(prisma, companyId, String(body.wipAccountId), "Compte de production en cours");
    data.wipAccountId = String(body.wipAccountId);
  }
  const updated = await prisma.manufacturingOrder.update({
    where: { id },
    data,
    include: orderInclude,
  });
  return serializeOrder(updated);
}

export async function releaseOrder({ id, companyId }) {
  const order = await prisma.manufacturingOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error("Ordre de fabrication introuvable.");
  if (order.status !== "DRAFT") throw new Error("Seul un ordre DRAFT peut être lancé.");
  const updated = await prisma.manufacturingOrder.update({
    where: { id },
    data: { status: "RELEASED", startedAt: new Date() },
    include: orderInclude,
  });
  return serializeOrder(updated);
}

function normalizeConsumptions(order, requestedComponents) {
  if (!Array.isArray(requestedComponents) || !requestedComponents.length) {
    return order.components
      .map((component) => ({
        componentId: component.id,
        quantity: toNumber(component.plannedQty) - toNumber(component.consumedQty),
      }))
      .filter((line) => line.quantity > EPSILON);
  }

  return requestedComponents.map((line, index) => {
    const componentId = String(line.componentId || line.id || "").trim();
    const quantity = Number(line.quantity);
    if (!componentId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Consommation ${index + 1}: composant et quantité positive requis.`);
    }
    return { componentId, quantity };
  });
}

export async function consumeOrder({ id, companyId, body = {} }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.manufacturingOrder.findFirst({
      where: { id, companyId },
      include: {
        ...orderInclude,
        components: {
          include: {
            product: { include: { inventory: true, inventoryAccount: true, stockVariationAccount: true } },
          },
        },
      },
    });
    if (!order) throw new Error("Ordre de fabrication introuvable.");
    if (!["RELEASED", "IN_PROGRESS"].includes(order.status)) {
      throw new Error("L'ordre doit être RELEASED ou IN_PROGRESS pour consommer.");
    }

    const consumptions = normalizeConsumptions(order, body.components);
    if (!consumptions.length) throw new Error("Aucune quantité restante à consommer.");
    const componentMap = new Map(order.components.map((component) => [component.id, component]));
    const allTransactions = [];
    const movements = [];

    for (const consumption of consumptions) {
      const component = componentMap.get(consumption.componentId);
      if (!component) throw new Error("Composant introuvable sur l'ordre.");
      const remaining = toNumber(component.plannedQty) - toNumber(component.consumedQty);
      if (consumption.quantity > remaining + EPSILON) {
        throw new Error("La consommation dépasse la quantité prévue restante.");
      }
      if (!component.product.inventoryAccountId) {
        throw new Error(`Compte de stock manquant pour ${component.product.name}.`);
      }

      const stock = await applyOutMovement(tx, {
        productId: component.productId,
        qty: consumption.quantity,
        companyId,
      });
      const amount = Number((stock.totalCost || 0).toFixed(2));
      const movement = await tx.stockMovement.create({
        data: {
          companyId,
          date: new Date(),
          productId: component.productId,
          movementType: "OUT",
          quantity: asDecimalString(consumption.quantity),
          unitCost: Number(stock.unitCost || 0).toFixed(4),
          totalCost: amount.toFixed(2),
          manufacturingOrderComponentId: component.id,
        },
      });
      movements.push(movement);

      const nextConsumed = toNumber(component.consumedQty) + consumption.quantity;
      const variance = nextConsumed - toNumber(component.plannedQty);
      await tx.manufacturingOrderComponent.update({
        where: { id: component.id },
        data: {
          consumedQty: asDecimalString(nextConsumed),
          varianceQty: asDecimalString(variance),
          status: Math.abs(variance) > EPSILON ? "ADJUSTED" : "CONSUMED",
        },
      });

      if (amount > 0) {
        const description = `Consommation production ${order.number} - ${component.product.sku || component.product.name}`;
        const wipTx = await tx.transaction.create({
          data: {
            companyId,
            date: movement.date,
            nature: "production",
            description,
            amount: amount.toFixed(2),
            direction: "DEBIT",
            kind: "PRODUCTION_WIP",
            accountId: order.wipAccountId,
          },
        });
        const stockTx = await tx.transaction.create({
          data: {
            companyId,
            date: movement.date,
            nature: "production",
            description,
            amount: amount.toFixed(2),
            direction: "CREDIT",
            kind: "INVENTORY_ASSET",
            accountId: component.product.inventoryAccountId,
          },
        });
        allTransactions.push(wipTx, stockTx);
      }
    }

    if (allTransactions.length) {
      await finalizeBatchToJournal(tx, {
        sourceType: "MANUFACTURING_ORDER",
        sourceId: order.id,
        supportRef: order.number,
        date: new Date(),
        description: `Consommation composants ${order.number}`,
        transactions: allTransactions,
      });
    }

    const updated = await tx.manufacturingOrder.update({
      where: { id: order.id },
      data: { status: "IN_PROGRESS" },
      include: orderInclude,
    });
    return { order: serializeOrder(updated), movements: movements.length };
  });
}

export async function completeOrder({ id, companyId, body = {} }) {
  const quantity = Number(body.quantity ?? body.producedQty);
  const scrapQty = body.scrapQty == null || body.scrapQty === "" ? 0 : Number(body.scrapQty);
  const declaredAt = normalizeDate(body.declaredAt) || new Date();
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantité produite positive requise.");
  if (!Number.isFinite(scrapQty) || scrapQty < 0) throw new Error("Quantité rebutée invalide.");

  return prisma.$transaction(async (tx) => {
    const order = await tx.manufacturingOrder.findFirst({
      where: { id, companyId },
      include: orderInclude,
    });
    if (!order) throw new Error("Ordre de fabrication introuvable.");
    if (order.status !== "IN_PROGRESS") {
      throw new Error("L'ordre doit être IN_PROGRESS pour déclarer la production.");
    }
    if (!order.product.inventoryAccountId) {
      throw new Error("Compte de stock manquant pour le produit fini.");
    }

    const consumedValue = await tx.stockMovement.aggregate({
      where: {
        companyId,
        manufacturingOrderComponent: { manufacturingOrderId: order.id },
      },
      _sum: { totalCost: true },
    });
    const totalConsumedValue = toNumber(consumedValue._sum.totalCost);
    const providedUnitCost = body.unitCost == null || body.unitCost === "" ? null : Number(body.unitCost);
    const unitCost =
      providedUnitCost != null && Number.isFinite(providedUnitCost)
        ? providedUnitCost
        : totalConsumedValue > 0
          ? totalConsumedValue / quantity
          : 0;
    const totalOutputValue = Number((unitCost * quantity).toFixed(2));

    const output = await tx.manufacturingOutput.create({
      data: {
        companyId,
        manufacturingOrderId: order.id,
        productId: order.productId,
        quantity: asDecimalString(quantity),
        unitCost: unitCost.toFixed(4),
        declaredAt,
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });
    const stock = await applyInMovement(tx, {
      productId: order.productId,
      qty: quantity,
      unitCost,
      stage: "AVAILABLE",
      companyId,
    });
    const movement = await tx.stockMovement.create({
      data: {
        companyId,
        date: declaredAt,
        productId: order.productId,
        movementType: "IN",
        quantity: asDecimalString(quantity),
        unitCost: unitCost.toFixed(4),
        totalCost: totalOutputValue.toFixed(2),
        manufacturingOutputId: output.id,
      },
    });

    if (totalOutputValue > 0) {
      const description = `Déclaration production ${order.number}`;
      const inventoryTx = await tx.transaction.create({
        data: {
          companyId,
          date: declaredAt,
          nature: "production",
          description,
          amount: totalOutputValue.toFixed(2),
          direction: "DEBIT",
          kind: "INVENTORY_ASSET",
          accountId: order.product.inventoryAccountId,
        },
      });
      const wipTx = await tx.transaction.create({
        data: {
          companyId,
          date: declaredAt,
          nature: "production",
          description,
          amount: totalOutputValue.toFixed(2),
          direction: "CREDIT",
          kind: "PRODUCTION_WIP",
          accountId: order.wipAccountId,
        },
      });
      await finalizeBatchToJournal(tx, {
        sourceType: "MANUFACTURING_ORDER",
        sourceId: order.id,
        supportRef: order.number,
        date: declaredAt,
        description,
        transactions: [inventoryTx, wipTx],
      });
    }

    const updated = await tx.manufacturingOrder.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        producedQty: asDecimalString(toNumber(order.producedQty) + quantity),
        scrapQty: asDecimalString(toNumber(order.scrapQty) + scrapQty),
        completedAt: declaredAt,
      },
      include: orderInclude,
    });

    return { order: serializeOrder(updated), output, movement, inventory: stock.inventory };
  });
}

export async function closeOrder({ id, companyId }) {
  const order = await prisma.manufacturingOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error("Ordre de fabrication introuvable.");
  if (order.status !== "COMPLETED") throw new Error("Seul un ordre COMPLETED peut être clôturé.");
  const updated = await prisma.manufacturingOrder.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
    include: orderInclude,
  });
  return serializeOrder(updated);
}

export async function cancelOrder({ id, companyId }) {
  const order = await prisma.manufacturingOrder.findFirst({ where: { id, companyId } });
  if (!order) throw new Error("Ordre de fabrication introuvable.");
  if (!["DRAFT", "RELEASED"].includes(order.status)) {
    throw new Error("Seuls les ordres DRAFT ou RELEASED peuvent être annulés.");
  }
  const updated = await prisma.manufacturingOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: orderInclude,
  });
  return serializeOrder(updated);
}
