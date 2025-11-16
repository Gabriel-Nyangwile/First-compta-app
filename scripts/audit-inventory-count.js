#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EPSILON = 1e-6;

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value?.toNumber) {
    try {
      return value.toNumber();
    } catch {
      const parsed = Number(String(value));
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toQty(value) {
  return toNumber(value).toFixed(3);
}

function toValue(value) {
  return toNumber(value).toFixed(2);
}

async function fetchCounts(includeDraft = false) {
  const where = includeDraft ? {} : { status: { in: ['COMPLETED', 'POSTED'] } };
  return prisma.inventoryCount.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      lines: {
        orderBy: { product: { sku: 'asc' } },
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
          movement: {
            select: {
              id: true,
              quantity: true,
              unitCost: true,
              totalCost: true,
              inventoryCountLineId: true,
            },
          },
        },
      },
    },
  });
}

async function fetchInventories(productIds) {
  const rows = await prisma.productInventory.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, qtyOnHand: true, avgCost: true },
  });
  const map = new Map();
  for (const row of rows) {
    map.set(row.productId, {
      qtyOnHand: toNumber(row.qtyOnHand),
      avgCost: row.avgCost == null ? null : toNumber(row.avgCost),
    });
  }
  return map;
}

function detectLineIssues(count, line, inventory) {
  const issues = [];
  const snapshotQty = toNumber(line.snapshotQty);
  const countedQty = line.countedQty == null ? null : toNumber(line.countedQty);
  const deltaQtyStored = line.deltaQty == null ? null : toNumber(line.deltaQty);
  const deltaValueStored = line.deltaValue == null ? null : toNumber(line.deltaValue);
  const computedDeltaQty = countedQty == null ? 0 : countedQty - snapshotQty;

  if (countedQty == null && count.status !== 'DRAFT') {
    issues.push("Quantité comptée manquante alors que le statut n'est plus DRAFT.");
  }

  if (count.status === 'POSTED') {
    if (Math.abs(computedDeltaQty - (deltaQtyStored ?? 0)) > EPSILON) {
      issues.push(`Delta quantité recalculé (${toQty(computedDeltaQty)}) ≠ valeur stockée (${toQty(deltaQtyStored ?? 0)}).`);
    }
  }

  if (count.status === 'POSTED') {
    if (!line.movement && Math.abs(computedDeltaQty) > EPSILON) {
      issues.push('Ajustement manquant (aucun StockMovement lié).');
    }
    if (line.movement && line.status !== 'POSTED') {
      issues.push('Mouvement présent mais statut de ligne ≠ POSTED.');
    }
  }

  if (line.movement) {
    const mvQty = toNumber(line.movement.quantity);
    if (Math.abs(Math.abs(mvQty) - Math.abs(computedDeltaQty)) > EPSILON) {
      issues.push(`Quantité mouvement (${toQty(mvQty)}) ≠ écart calculé (${toQty(computedDeltaQty)}).`);
    }
    if (line.movement.inventoryCountLineId !== line.id) {
      issues.push('Movement.inventoryCountLineId ne renvoie pas vers la ligne.');
    }
    const movementTotal = toNumber(line.movement.totalCost ?? 0);
    if (Math.abs(movementTotal - Math.abs(deltaValueStored ?? 0)) > 0.01) {
      issues.push(`Total cost mouvement (${toValue(movementTotal)}) ≠ delta stocké (${toValue(deltaValueStored ?? 0)}).`);
    }
  }

  if (!line.product.inventoryAccountId || !line.product.stockVariationAccountId) {
    issues.push('Comptes comptables inventaire/variation manquants sur le produit.');
  }

  if (count.status === 'POSTED' && inventory) {
    const approxExpected = snapshotQty + computedDeltaQty;
    const residual = inventory.qtyOnHand - approxExpected;
    if (Math.abs(residual) > 0.5) {
      issues.push(`Stock courant (${toQty(inventory.qtyOnHand)}) s'écarte du snapshot+delta (${toQty(approxExpected)}).`);
    }
  }

  return issues;
}

async function main() {
  const includeDraft = process.argv.includes('--include-draft');
  const counts = await fetchCounts(includeDraft);
  if (!counts.length) {
    console.log('Aucun inventaire trouvé.');
    return;
  }

  const productIds = Array.from(
    new Set(
      counts.flatMap((count) => (count.lines || []).map((line) => line.productId))
    )
  );
  const inventories = await fetchInventories(productIds);

  let issuesFound = 0;
  for (const count of counts) {
    const countLabel = `${count.number} (${count.status})`;
    const countIssues = [];

    for (const line of count.lines || []) {
      const inventory = inventories.get(line.productId);
      const lineIssues = detectLineIssues(count, line, inventory);
      if (lineIssues.length) {
        countIssues.push({ line, issues: lineIssues });
      }
    }

    if (count.status === 'COMPLETED') {
      const pending = (count.lines || []).some((line) => line.countedQty == null);
      if (pending) {
        countIssues.push({ line: null, issues: ['Inventaire COMPLETED contenant des lignes non comptées.'] });
      }
    }

    if (countIssues.length) {
      issuesFound += countIssues.length;
      console.log(`\n⚠️  ${countLabel}`);
      for (const entry of countIssues) {
        if (entry.line) {
          const sku = entry.line.product?.sku || entry.line.productId;
          console.log(`   - Ligne ${entry.line.id} (${sku})`);
          entry.issues.forEach((msg) => console.log(`      • ${msg}`));
        } else {
          entry.issues.forEach((msg) => console.log(`   - ${msg}`));
        }
      }
    }
  }

  if (!issuesFound) {
    console.log('✅ Aucun écart détecté sur les inventaires analysés.');
  } else {
    console.log(`\nInspection terminée : ${issuesFound} anomalie(s) détectée(s).`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
