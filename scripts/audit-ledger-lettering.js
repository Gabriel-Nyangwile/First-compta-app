#!/usr/bin/env node
/**
 * Audit script: validate transaction lettering consistency.
 * - Checks that letteredAmount stays within [0, amount]
 * - Verifies status coherence (UNMATCHED/PARTIAL/MATCHED) against amounts
 * - Warns about negative outstanding values or missing refs on matched lines
 * Usage: node scripts/audit-ledger-lettering.js [--fix] [--no-exit-error]
 */
import { fileURLToPath } from "node:url";
import { Prisma, TransactionLetterStatus } from "@prisma/client";
import prisma from "../src/lib/prisma.js";

const ZERO = new Prisma.Decimal(0);
const TOLERANCE = new Prisma.Decimal("0.01");

const toDecimal = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  if (value == null) return ZERO;
  try {
    return new Prisma.Decimal(value);
  } catch (e) {
    return ZERO;
  }
};

const approxZero = (value) => value.abs().lte(TOLERANCE);
const approxEqual = (a, b) => a.minus(b).abs().lte(TOLERANCE);

async function auditTransactions({ fix = false } = {}) {
  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      amount: true,
      direction: true,
      letterStatus: true,
      letterRef: true,
      letteredAmount: true,
      letteredAt: true,
      description: true,
      account: { select: { id: true, number: true, label: true } },
      journalEntry: {
        select: {
          id: true,
          number: true,
          date: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
  });

  const findings = [];

  for (const tx of transactions) {
    const amount = toDecimal(tx.amount);
    let lettered = toDecimal(tx.letteredAmount);

    const issues = [];

    if (lettered.lt(ZERO) && !approxZero(lettered)) {
      issues.push("letteredAmount negative");
      lettered = ZERO;
    }

    if (lettered.gt(amount) && !approxEqual(lettered, amount)) {
      issues.push("letteredAmount exceeds amount");
      lettered = amount;
    }

    const outstanding = amount.minus(lettered);
    const normalizedOutstanding =
      outstanding.lt(ZERO) && outstanding.abs().lte(TOLERANCE)
        ? ZERO
        : outstanding;

    if (normalizedOutstanding.lt(ZERO)) {
      issues.push("outstanding negative beyond tolerance");
    }

    let expectedStatus;
    if (approxZero(amount)) {
      expectedStatus = TransactionLetterStatus.MATCHED;
    } else if (approxZero(lettered)) {
      expectedStatus = TransactionLetterStatus.UNMATCHED;
    } else if (approxEqual(lettered, amount)) {
      expectedStatus = TransactionLetterStatus.MATCHED;
    } else {
      expectedStatus = TransactionLetterStatus.PARTIAL;
    }

    if (tx.letterStatus !== expectedStatus) {
      issues.push(`status ${tx.letterStatus} -> expected ${expectedStatus}`);
    }

    if (
      tx.letterStatus === TransactionLetterStatus.MATCHED &&
      !approxEqual(lettered, amount) &&
      !approxZero(amount)
    ) {
      issues.push("status MATCHED but outstanding remains");
    }

    if (
      expectedStatus === TransactionLetterStatus.MATCHED &&
      approxEqual(lettered, amount) &&
      !tx.letterRef
    ) {
      issues.push("matched without letterRef");
    }

    const updatedData = {};
    if (!approxEqual(lettered, toDecimal(tx.letteredAmount))) {
      updatedData.letteredAmount = lettered;
    }
    if (tx.letterStatus !== expectedStatus) {
      updatedData.letterStatus = expectedStatus;
    }

    if (issues.length) {
      findings.push({
        transactionId: tx.id,
        account: tx.account
          ? `${tx.account.number} ${tx.account.label}`
          : "(sans compte)",
        journalEntry: tx.journalEntry ? tx.journalEntry.number : null,
        amount: amount.toString(),
        lettered: lettered.toString(),
        outstanding: normalizedOutstanding.toString(),
        status: tx.letterStatus,
        expectedStatus,
        issues,
      });

      if (fix && Object.keys(updatedData).length) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: updatedData,
        });
      }
    }
  }

  return findings;
}

export async function auditLettering({ fix = false } = {}) {
  const findings = await auditTransactions({ fix });
  return findings;
}

async function runCli() {
  const args = process.argv.slice(2);
  const doFix = args.includes("--fix");
  const noExitError = args.includes("--no-exit-error");

  try {
    const findings = await auditLettering({ fix: doFix });
    if (!findings.length) {
      console.log("Audit OK: all transactions consistent.");
    } else {
      console.log(`Found ${findings.length} lettering discrepancies.`);
      console.log(JSON.stringify(findings, null, 2));
      if (doFix) {
        console.log(
          "Fix mode enabled: attempted to normalize stored values where possible."
        );
      } else if (!noExitError) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error("audit-ledger-lettering failed", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli();
}
