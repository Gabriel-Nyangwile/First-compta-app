#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { nextSequence } from "../src/lib/sequence.js";

const prisma = new PrismaClient();
const EPSILON = 0.0005;

function parseArgs(argv) {
  const args = {
    apply: false,
    company: null,
    companyId: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry" || arg === "--dry-run") args.apply = false;
    else if (arg === "--company" || arg === "--companyId") args[arg.slice(2)] = argv[++i] || "";
    else if (arg.startsWith("--company=")) args.company = arg.slice("--company=".length);
    else if (arg.startsWith("--companyId=")) args.companyId = arg.slice("--companyId=".length);
    else {
      throw new Error(`Option inconnue: ${arg}`);
    }
  }

  return args;
}

function toNumber(value) {
  return Number(value || 0);
}

function round3(value) {
  return Number(value.toFixed(3));
}

function decimal3(value) {
  return round3(value).toFixed(3);
}

function decimal4(value) {
  return Number(value).toFixed(4);
}

function decimal2(value) {
  return Number(value).toFixed(2);
}

async function resolveCompanyFilter(args) {
  if (args.companyId) return { id: args.companyId };
  if (!args.company) return null;

  const company = await prisma.company.findFirst({
    where: { name: args.company },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`Societe introuvable: ${args.company}`);
  return { id: company.id };
}

async function collectDivergences(companyFilter = null) {
  const products = await prisma.product.findMany({
    where: companyFilter ? { companyId: companyFilter.id } : {},
    select: {
      id: true,
      sku: true,
      name: true,
      companyId: true,
      company: { select: { name: true } },
      inventory: {
        select: {
          qtyOnHand: true,
          qtyStaged: true,
          avgCost: true,
        },
      },
    },
    orderBy: [{ companyId: "asc" }, { sku: "asc" }],
  });

  const rows = [];
  for (const product of products) {
    const agg = await prisma.stockMovement.groupBy({
      by: ["productId", "movementType", "stage"],
      where: { productId: product.id },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    let calcOnHand = 0;
    let calcStaged = 0;
    let movementCount = 0;
    for (const group of agg) {
      const qty = toNumber(group._sum.quantity);
      const signedQty = group.movementType === "OUT" ? -qty : qty;
      if (group.stage === "STAGED") calcStaged += signedQty;
      else calcOnHand += signedQty;
      movementCount += group._count._all;
    }

    const storedOnHand = toNumber(product.inventory?.qtyOnHand);
    const storedStaged = toNumber(product.inventory?.qtyStaged);
    const deltaOnHand = round3(storedOnHand - calcOnHand);
    const deltaStaged = round3(storedStaged - calcStaged);

    if (Math.abs(deltaOnHand) > EPSILON || Math.abs(deltaStaged) > EPSILON) {
      rows.push({
        product,
        movementCount,
        calcOnHand: round3(calcOnHand),
        storedOnHand: round3(storedOnHand),
        deltaOnHand,
        calcStaged: round3(calcStaged),
        storedStaged: round3(storedStaged),
        deltaStaged,
        avgCost: toNumber(product.inventory?.avgCost),
      });
    }
  }

  return rows;
}

function formatRow(row) {
  const parts = [];
  if (Math.abs(row.deltaOnHand) > EPSILON) parts.push(`AVAILABLE ${decimal3(row.deltaOnHand)}`);
  if (Math.abs(row.deltaStaged) > EPSILON) parts.push(`STAGED ${decimal3(row.deltaStaged)}`);
  return `${row.product.company.name} | ${row.product.sku} ${row.product.name} | mouvements=${row.movementCount} | a creer: ${parts.join(", ")}`;
}

async function applyRows(rows) {
  let created = 0;
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const movements = [
        { stage: "AVAILABLE", qty: row.deltaOnHand },
        { stage: "STAGED", qty: row.deltaStaged },
      ].filter((movement) => Math.abs(movement.qty) > EPSILON);

      for (const movement of movements) {
        const voucherRef = await nextSequence(
          tx,
          "STOCK_RECONCILIATION",
          "STK-REC-",
          row.product.companyId
        );
        await tx.stockMovement.create({
          data: {
            companyId: row.product.companyId,
            date: new Date(),
            productId: row.product.id,
            movementType: "ADJUST",
            stage: movement.stage,
            quantity: decimal3(movement.qty),
            unitCost: row.avgCost ? decimal4(row.avgCost) : null,
            totalCost: row.avgCost ? decimal2(row.avgCost * movement.qty) : null,
            voucherRef,
          },
        });
        created += 1;
      }
    });
  }
  return created;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companyFilter = await resolveCompanyFilter(args);
  const rows = await collectDivergences(companyFilter);

  if (!rows.length) {
    console.log("[stock-reconcile] Aucune divergence stock a regulariser.");
    return;
  }

  console.log(`[stock-reconcile] Divergences detectees: ${rows.length}`);
  for (const row of rows) console.log(`- ${formatRow(row)}`);

  if (!args.apply) {
    console.log("[stock-reconcile] Dry-run uniquement. Relancer avec --apply pour creer les mouvements.");
    return;
  }

  const created = await applyRows(rows);
  console.log(`[stock-reconcile] Mouvements crees: ${created}`);
}

main()
  .catch((error) => {
    console.error("[stock-reconcile] Echec:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
