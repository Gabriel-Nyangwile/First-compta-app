#!/usr/bin/env node
/**
 * Backfill transaction lettering metadata.
 * - Recomputes letteredAmount per transaction based on grouped letterRef totals
 * - Normalises letterStatus (UNMATCHED / PARTIAL / MATCHED)
 * - Keeps letteredAt when matched, resets it when status becomes unmatched
 *
 * Usage:
 *   node scripts/backfill-transaction-lettering.js [--dry] [--verbose] [--ref=LETTERREF]
 */
import {
  Prisma,
  TransactionDirection,
  TransactionLetterStatus,
} from "@prisma/client";
import prisma from "../src/lib/prisma.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const verbose = args.includes("--verbose");
const refArg = args.find((arg) => arg.startsWith("--ref="));
const refFilter = refArg ? refArg.split("=")[1]?.trim() || null : null;

const ZERO = new Prisma.Decimal(0);
const TOLERANCE = new Prisma.Decimal("0.01");

const toDecimal = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  if (value == null) return ZERO;
  try {
    return new Prisma.Decimal(value);
  } catch (error) {
    return ZERO;
  }
};

const approxZero = (value) => value.abs().lte(TOLERANCE);
const approxEqual = (a, b) => a.minus(b).abs().lte(TOLERANCE);
const minDecimal = (a, b) => (a.lte(b) ? a : b);

const determineStatus = (amount, lettered) => {
  if (approxZero(amount)) return TransactionLetterStatus.MATCHED;
  if (approxZero(lettered)) return TransactionLetterStatus.UNMATCHED;
  if (approxEqual(lettered, amount)) return TransactionLetterStatus.MATCHED;
  return TransactionLetterStatus.PARTIAL;
};

const sumAmounts = (transactions) =>
  transactions.reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);

async function main() {
  try {
    console.log(
      `Running backfill-transaction-lettering ${
        dryRun ? "(dry-run) " : ""
      }${refFilter ? `(ref=${refFilter})` : ""}`.trim()
    );

    const transactions = await prisma.transaction.findMany({
      where: refFilter ? { letterRef: refFilter } : undefined,
      select: {
        id: true,
        letterRef: true,
        letterStatus: true,
        letteredAmount: true,
        letteredAt: true,
        amount: true,
        direction: true,
        date: true,
      },
      orderBy: [
        { letterRef: "asc" },
        { date: "asc" },
        { id: "asc" },
      ],
    });

    if (!transactions.length) {
      console.log("No transactions found for provided filters.");
      return;
    }

    const groups = new Map();
    for (const tx of transactions) {
      const key = tx.letterRef ?? "__UNLETTERED__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tx);
    }

    const updates = [];
    let touchedGroups = 0;

    for (const [ref, list] of groups.entries()) {
      const expectedMap = new Map();

      if (ref === "__UNLETTERED__") {
        for (const tx of list) {
          const amount = toDecimal(tx.amount);
          const expectedLettered = approxZero(amount) ? amount : ZERO;
          const expectedStatus = determineStatus(amount, expectedLettered);
          let expectedLetteredAt = tx.letteredAt;

          if (expectedStatus === TransactionLetterStatus.MATCHED) {
            expectedLetteredAt = expectedLetteredAt ?? tx.date;
          } else if (expectedLetteredAt) {
            expectedLetteredAt = null;
          }

          expectedMap.set(tx.id, {
            letteredAmount: expectedLettered,
            letterStatus: expectedStatus,
            letteredAt: expectedLetteredAt,
          });
        }
      } else {
        const debits = list.filter(
          (tx) => tx.direction === TransactionDirection.DEBIT
        );
        const credits = list.filter(
          (tx) => tx.direction === TransactionDirection.CREDIT
        );

        const debitTotal = sumAmounts(debits);
        const creditTotal = sumAmounts(credits);
        const matchedTotal = minDecimal(debitTotal, creditTotal);

        let remainingDebit = matchedTotal;
        for (const tx of debits) {
          const amount = toDecimal(tx.amount);
          const allocation = minDecimal(amount, remainingDebit);
          expectedMap.set(tx.id, { letteredAmount: allocation });
          remainingDebit = remainingDebit.minus(allocation);
          if (remainingDebit.lt(ZERO)) remainingDebit = ZERO;
        }

        let remainingCredit = matchedTotal;
        for (const tx of credits) {
          const amount = toDecimal(tx.amount);
          const allocation = minDecimal(amount, remainingCredit);
          expectedMap.set(tx.id, { letteredAmount: allocation });
          remainingCredit = remainingCredit.minus(allocation);
          if (remainingCredit.lt(ZERO)) remainingCredit = ZERO;
        }

        for (const tx of list) {
          const amount = toDecimal(tx.amount);
          const current = expectedMap.get(tx.id) || { letteredAmount: ZERO };
          const lettered = current.letteredAmount ?? ZERO;
          const expectedStatus = determineStatus(amount, lettered);
          let expectedLetteredAt = tx.letteredAt;

          if (expectedStatus === TransactionLetterStatus.MATCHED) {
            expectedLetteredAt = expectedLetteredAt ?? tx.date;
          } else if (expectedLetteredAt) {
            expectedLetteredAt = null;
          }

          expectedMap.set(tx.id, {
            letteredAmount: lettered,
            letterStatus: expectedStatus,
            letteredAt: expectedLetteredAt,
          });
        }
      }

      let groupChanged = false;

      for (const tx of list) {
        const expectation = expectedMap.get(tx.id);
        const currentLettered = toDecimal(tx.letteredAmount);
        const statusChanged = tx.letterStatus !== expectation.letterStatus;
        const letteredChanged = !approxEqual(
          expectation.letteredAmount,
          currentLettered
        );
        const letteredAtChanged = (() => {
          const currentDate = tx.letteredAt ? tx.letteredAt.getTime() : null;
          const expectedDate = expectation.letteredAt
            ? expectation.letteredAt.getTime()
            : null;
          return currentDate !== expectedDate;
        })();

        if (letteredChanged || statusChanged || letteredAtChanged) {
          const data = {};
          if (letteredChanged) data.letteredAmount = expectation.letteredAmount;
          if (statusChanged) data.letterStatus = expectation.letterStatus;
          if (letteredAtChanged) data.letteredAt = expectation.letteredAt;

          updates.push({ id: tx.id, data, letterRef: tx.letterRef });
          groupChanged = true;
        }
      }

      if (groupChanged) {
        touchedGroups += 1;
        if (verbose) {
          console.log(
            `letterRef=${ref === "__UNLETTERED__" ? "(none)" : ref}: queued ${list.length} tx`
          );
        }
      }
    }

    if (!updates.length) {
      console.log("Nothing to update: lettering already consistent.");
      return;
    }

    console.log(
      `Prepared ${updates.length} transaction updates across ${touchedGroups} letter groups.`
    );

    if (dryRun) {
      console.log("Dry-run enabled: no database changes applied.");
      return;
    }

    for (const update of updates) {
      await prisma.transaction.update({ where: { id: update.id }, data: update.data });
      if (verbose) {
        console.log(`Updated ${update.id} (${update.letterRef ?? "no ref"})`, update.data);
      }
    }

    console.log("Backfill complete.");
  } catch (error) {
    console.error("Backfill transaction lettering failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
