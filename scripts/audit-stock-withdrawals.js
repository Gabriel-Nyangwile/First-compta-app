#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

const EPSILON = 1e-6;

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value?.toNumber) {
    try {
      return value.toNumber();
    } catch (err) {
      return Number(value) || 0;
    }
  }
  return Number(value) || 0;
}

function formatAmount(value, digits = 2) {
  return toNumber(value).toFixed(digits);
}

function formatQty(value) {
  return toNumber(value).toFixed(3);
}

async function fetchWithdrawals() {
  return prisma.stockWithdrawal.findMany({
    include: {
      lines: {
        include: {
          movements: {
            select: {
              id: true,
              quantity: true,
              unitCost: true,
              totalCost: true,
              goodsReceiptLineId: true,
              invoiceLineId: true,
              returnOrderLineId: true,
              stockWithdrawalLineId: true,
            },
          },
        },
      },
    },
    orderBy: { requestedAt: "asc" },
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
      avgCost: row.avgCost != null ? toNumber(row.avgCost) : null,
    });
  }
  return map;
}

function validatePostedWithdrawal(withdrawal, inventories) {
  const problems = [];
  const postedLines = withdrawal.lines || [];

  if (!postedLines.length) {
    problems.push("POSTED sans aucune ligne");
    return problems;
  }

  for (const line of postedLines) {
    const qty = toNumber(line.quantity);
    if (qty <= 0) {
      problems.push(`Ligne ${line.id} quantité invalide (${qty}).`);
      continue;
    }

    const movements = line.movements || [];
    const outMovements = movements.filter(
      (movement) => toNumber(movement.quantity) > 0
    );

    if (!outMovements.length) {
      problems.push(
        `Ligne ${line.id}: aucun mouvement de sortie en stage AVAILABLE.`
      );
      continue;
    }

    if (outMovements.length > 1) {
      problems.push(
        `Ligne ${line.id}: ${outMovements.length} mouvements de sortie trouvés (1 attendu).`
      );
    }

    const movement = outMovements[0];
    const movementQty = toNumber(movement.quantity);
    if (Math.abs(movementQty - qty) > EPSILON) {
      problems.push(
        `Ligne ${line.id}: quantité mouvement (${formatQty(
          movementQty
        )}) différente de la ligne (${formatQty(qty)}).`
      );
    }

    const unitCost = toNumber(line.unitCost);
    const totalCost = toNumber(line.totalCost);
    const mvUnitCost = toNumber(movement.unitCost);
    const mvTotalCost = toNumber(movement.totalCost);

    if (Math.abs(mvUnitCost - unitCost) > EPSILON) {
      problems.push(
        `Ligne ${line.id}: coût unitaire mouvement (${formatAmount(
          mvUnitCost,
          4
        )}) ≠ ligne (${formatAmount(unitCost, 4)}).`
      );
    }

    if (Math.abs(mvTotalCost - totalCost) > EPSILON) {
      problems.push(
        `Ligne ${line.id}: montant mouvement (${formatAmount(
          mvTotalCost
        )}) ≠ ligne (${formatAmount(totalCost)}).`
      );
    }

    const inventory = inventories.get(line.productId);
    if (!inventory) {
      problems.push(
        `Produit ${line.productId}: inventaire introuvable lors du contrôle.`
      );
      continue;
    }

    if (inventory.avgCost != null && Math.abs(inventory.avgCost) > EPSILON) {
      // On ne peut pas déduire le coût cible sans historique complet.
      // On vérifie cependant que la sortie n'a pas fait passer le stock négatif.
      const remainingQty = inventory.qtyOnHand;
      if (remainingQty < -EPSILON) {
        problems.push(
          `Produit ${line.productId}: stock total (${formatQty(
            remainingQty
          )}) négatif après sorties.`
        );
      }
    }
  }

  return problems;
}

function validateDraftOrConfirmed(withdrawal) {
  const problems = [];
  const lines = withdrawal.lines || [];
  if (!lines.length) {
    problems.push("Aucune ligne enregistrée.");
    return problems;
  }

  for (const line of lines) {
    const qty = toNumber(line.quantity);
    if (qty <= 0) {
      problems.push(`Ligne ${line.id} quantité invalide (${qty}).`);
    }
    if ((line.movements || []).length) {
      problems.push(
        `Ligne ${line.id} possède déjà des mouvements alors que le statut est ${withdrawal.status}.`
      );
    }
  }

  return problems;
}

async function main() {
  console.log("— Audit sorties de stock —");
  const withdrawals = await fetchWithdrawals();
  if (!withdrawals.length) {
    console.log("Aucune sortie de stock trouvée.");
    return;
  }

  const productIds = Array.from(
    new Set(
      withdrawals.flatMap((w) => (w.lines || []).map((line) => line.productId))
    )
  );
  const inventories = await fetchInventories(productIds);

  let errors = 0;
  let warnings = 0;

  for (const withdrawal of withdrawals) {
    const label = `${withdrawal.number} (${withdrawal.status})`;
    let issues = [];
    if (withdrawal.status === "POSTED") {
      issues = validatePostedWithdrawal(withdrawal, inventories);
    } else if (
      withdrawal.status === "CONFIRMED" ||
      withdrawal.status === "DRAFT"
    ) {
      issues = validateDraftOrConfirmed(withdrawal);
    }

    if (!issues.length) continue;

    console.log(`\n⚠️  ${label}`);
    for (const issue of issues) {
      console.log(`   - ${issue}`);
    }

    errors += issues.length;
    warnings += 1;
  }

  if (!warnings) {
    console.log("\n✅ Toutes les sorties de stock semblent cohérentes.");
  } else {
    console.log(
      `\nInspection terminée : ${warnings} sortie(s) avec anomalies.`
    );
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
