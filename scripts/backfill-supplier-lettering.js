#!/usr/bin/env node
/**
 * backfill-supplier-lettering.js
 *
 * Automatic matching for supplier ledger transactions.
 *
 * Strategy:
 *  - Iterate over money movements of kind SUPPLIER_PAYMENT.
 *  - Collect related PAYABLE / PAYMENT transactions.
 *  - When debits and credits offset (within tolerance) and no letterRef is set,
 *    allocate a new letterRef (LTR-###### via nextSequence) and mark them MATCHED.
 *  - Updates set letteredAmount to the transaction amount and letteredAt to movement date.
 *
 * Usage:
 *   node scripts/backfill-supplier-lettering.js [--dry] [--verbose] [--supplier=<id>]
 */

import { Prisma, TransactionLetterStatus } from "@prisma/client";
import prisma from "../src/lib/prisma.js";
import { nextSequence } from "../src/lib/sequence.js";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry");
const isVerbose = args.includes("--verbose");
const supplierArg = args.find((arg) => arg.startsWith("--supplier="));
const supplierFilter = supplierArg
  ? supplierArg.split("=")[1]?.trim() || null
  : null;

const ZERO = new Prisma.Decimal(0);
const TOLERANCE = new Prisma.Decimal("0.01");

const toDecimal = (value) => {
  if (value === null || value === undefined) return ZERO;
  if (value instanceof Prisma.Decimal) return value;
  try {
    return new Prisma.Decimal(value);
  } catch (error) {
    return ZERO;
  }
};

const approxEqual = (a, b) => a.minus(b).abs().lte(TOLERANCE);

const formatAmount = (value) => toDecimal(value).toFixed(2);

async function fetchCandidateMovements() {
  const whereClause = {
    kind: "SUPPLIER_PAYMENT",
    ...(supplierFilter ? { supplierId: supplierFilter } : {}),
  };

  return prisma.moneyMovement.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
    include: {
      moneyAccount: { select: { label: true } },
      supplier: { select: { id: true, name: true } },
      incomingInvoice: {
        select: { id: true, entryNumber: true, supplierId: true },
      },
      transactions: {
        where: { kind: { in: ["PAYABLE", "PAYMENT"] } },
        select: {
          id: true,
          amount: true,
          direction: true,
          kind: true,
          supplierId: true,
          incomingInvoiceId: true,
          letterRef: true,
          letterStatus: true,
          letteredAmount: true,
          letteredAt: true,
          date: true,
        },
        orderBy: { date: "asc" },
      },
    },
  });
}

function deriveSupplierInfo(movement) {
  if (movement.supplier) return movement.supplier;
  const txWithSupplier = movement.transactions.find((tx) => tx.supplierId);
  if (txWithSupplier) return { id: txWithSupplier.supplierId, name: null };
  if (movement.incomingInvoice?.supplierId)
    return { id: movement.incomingInvoice.supplierId, name: null };
  return { id: null, name: null };
}

function needMatching(transactions) {
  const pending = transactions.filter(
    (tx) => !tx.letterRef || tx.letterStatus !== TransactionLetterStatus.MATCHED
  );
  if (pending.length === 0) return false;

  const debitSum = transactions
    .filter((tx) => tx.direction === "DEBIT")
    .reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);
  const creditSum = transactions
    .filter((tx) => tx.direction === "CREDIT")
    .reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);

  return approxEqual(debitSum, creditSum);
}

function buildUpdatesForMovement(movement, letterRef) {
  const updates = [];
  for (const tx of movement.transactions) {
    const amountDecimal = toDecimal(tx.amount);
    updates.push({
      id: tx.id,
      data: {
        letterRef,
        letterStatus: TransactionLetterStatus.MATCHED,
        letteredAmount: amountDecimal,
        letteredAt: tx.letteredAt || movement.date,
      },
    });
  }
  return updates;
}

async function main() {
  try {
    console.log(
      `Running backfill-supplier-lettering ${isDryRun ? "(dry-run) " : ""}${
        supplierFilter ? `(supplier=${supplierFilter})` : ""
      }`.trim()
    );

    const movements = await fetchCandidateMovements();
    if (!movements.length) {
      console.log("No supplier payments found.");
      return;
    }

    let totalMatchedGroups = 0;
    let totalTransactionsUpdated = 0;
    const allUpdates = [];

    for (const movement of movements) {
      if (!movement.transactions.length) continue;
      if (!needMatching(movement.transactions)) continue;

      const alreadyMatched = movement.transactions.every(
        (tx) =>
          tx.letterRef && tx.letterStatus === TransactionLetterStatus.MATCHED
      );
      if (alreadyMatched) continue;

      const supplierInfo = deriveSupplierInfo(movement);
      const debitSum = movement.transactions
        .filter((tx) => tx.direction === "DEBIT")
        .reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);
      const creditSum = movement.transactions
        .filter((tx) => tx.direction === "CREDIT")
        .reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);

      const letterRef = await nextSequence(prisma, "LTR", "LTR-");
      const updates = buildUpdatesForMovement(movement, letterRef);
      allUpdates.push(...updates);

      totalMatchedGroups += 1;
      totalTransactionsUpdated += updates.length;

      if (isVerbose) {
        console.log(
          `Matched movement ${
            movement.id
          } (${movement.date.toISOString()}) supplier=${
            supplierInfo.id || "unknown"
          } amount debit=${formatAmount(debitSum)} credit=${formatAmount(
            creditSum
          )} => ${letterRef}`
        );
        for (const tx of movement.transactions) {
          console.log(
            `  - tx=${tx.id} kind=${tx.kind} dir=${
              tx.direction
            } amount=${formatAmount(tx.amount)} invoice=${
              tx.incomingInvoiceId || "none"
            }`
          );
        }
      }
    }

    if (!allUpdates.length) {
      console.log(
        "Nothing to update: no eligible supplier payments required matching."
      );
      return;
    }

    console.log(
      `Prepared ${allUpdates.length} transaction updates across ${totalMatchedGroups} movement groups.`
    );

    if (isDryRun) {
      console.log("Dry-run enabled: no database changes applied.");
      return;
    }

    await prisma.$transaction(async (txClient) => {
      for (const update of allUpdates) {
        await txClient.transaction.update({
          where: { id: update.id },
          data: update.data,
        });
      }
    });

    console.log(
      `Backfill complete. Updated ${totalTransactionsUpdated} transactions.`
    );
  } catch (error) {
    console.error("backfill-supplier-lettering failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
