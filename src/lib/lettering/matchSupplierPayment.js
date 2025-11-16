import { Prisma, TransactionLetterStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";

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

const collectGroupTransactions = async (letterRef) => {
  if (!letterRef) return [];
  return prisma.transaction.findMany({
    where: { letterRef },
    select: {
      id: true,
      amount: true,
      direction: true,
      letterRef: true,
      letterStatus: true,
      letteredAmount: true,
    },
  });
};

export async function matchSupplierPayment({ movementId }) {
  if (!movementId) throw new Error("movementId requis");

  const movement = await prisma.moneyMovement.findUnique({
    where: { id: movementId },
    include: {
      transactions: {
        where: { kind: { in: ["PAYABLE", "PAYMENT"] } },
        select: {
          id: true,
          direction: true,
          amount: true,
          letterRef: true,
          letterStatus: true,
          letteredAmount: true,
          letteredAt: true,
        },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!movement) throw new Error("Mouvement introuvable");

  const transactions = movement.transactions;
  if (!transactions.length) {
    return { updated: 0, letterRef: null, status: "NO_TRANSACTIONS" };
  }

  const debitSum = transactions
    .filter((tx) => tx.direction === "DEBIT")
    .reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);
  const creditSum = transactions
    .filter((tx) => tx.direction === "CREDIT")
    .reduce((acc, tx) => acc.plus(toDecimal(tx.amount)), ZERO);

  if (!approxEqual(debitSum, creditSum)) {
    return { updated: 0, letterRef: null, status: "NOT_BALANCED" };
  }

  const existingRef = transactions[0].letterRef;
  if (existingRef) {
    const related = await collectGroupTransactions(existingRef);
    const mismatched = related.find(
      (tx) => !approxEqual(toDecimal(tx.amount), toDecimal(tx.letteredAmount))
    );
    if (!mismatched) {
      return {
        updated: 0,
        letterRef: existingRef,
        status: "ALREADY_MATCHED",
      };
    }
  }

  const letterRef = existingRef || (await nextSequence(prisma, "LTR", "LTR-"));
  const now = new Date();
  const updates = transactions.map((tx) => ({
    id: tx.id,
    data: {
      letterRef,
      letterStatus: TransactionLetterStatus.MATCHED,
      letteredAmount: toDecimal(tx.amount),
      letteredAt: tx.letteredAt || now,
    },
  }));

  await prisma.$transaction(async (client) => {
    for (const update of updates) {
      await client.transaction.update({
        where: { id: update.id },
        data: update.data,
      });
    }
  });

  return {
    updated: updates.length,
    letterRef,
    status: "MATCHED",
  };
}
