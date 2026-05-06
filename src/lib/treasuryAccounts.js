import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const TREASURY_ACCOUNT_PREFIXES = ["51", "52", "53", "54", "56", "57", "58"];

export function isTreasuryAccountNumber(number) {
  return TREASURY_ACCOUNT_PREFIXES.some((prefix) =>
    String(number || "").startsWith(prefix)
  );
}

export function classifyTreasuryAccount(number) {
  const value = String(number || "");
  if (value.startsWith("52")) return "BANK";
  if (value.startsWith("53")) return "FINANCIAL_INSTITUTION";
  if (value.startsWith("57")) return "CASH";
  if (value.startsWith("56")) return "TREASURY_CREDIT";
  if (value.startsWith("58")) return "INTERNAL_TRANSFER";
  if (value.startsWith("54")) return "TREASURY_INSTRUMENT";
  if (value.startsWith("51")) return "COLLECTION_VALUE";
  return "TREASURY";
}

function decimalToNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

function hasMaterialAmount(value) {
  return Math.abs(decimalToNumber(value)) > 0.009;
}

function treasuryAccountWhere(companyId) {
  return {
    companyId,
    OR: TREASURY_ACCOUNT_PREFIXES.map((prefix) => ({
      number: { startsWith: prefix },
    })),
  };
}

export async function listTreasuryLedgerAccountsWithBalance(
  companyId,
  { includeUnused = false } = {}
) {
  if (!companyId) throw new Error("companyId requis");

  const accounts = await prisma.account.findMany({
    where: treasuryAccountWhere(companyId),
    orderBy: { number: "asc" },
    include: {
      moneyAccounts: {
        select: {
          id: true,
          type: true,
          label: true,
          currency: true,
          openingBalance: true,
          isActive: true,
        },
      },
    },
  });

  if (!accounts.length) return [];

  const accountIds = accounts.map((account) => account.id);
  const groupedTransactions = await prisma.transaction.groupBy({
    by: ["accountId", "direction"],
    where: { companyId, accountId: { in: accountIds } },
    _sum: { amount: true },
  });

  const unpostedMovements = await prisma.moneyMovement.findMany({
    where: {
      companyId,
      transactions: { none: {} },
      moneyAccount: { ledgerAccountId: { in: accountIds } },
    },
    select: {
      amount: true,
      direction: true,
      moneyAccount: { select: { ledgerAccountId: true } },
    },
  });

  const transactionSums = new Map();
  for (const row of groupedTransactions) {
    const current = transactionSums.get(row.accountId) || {
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
    };
    const amount = row._sum.amount || new Prisma.Decimal(0);
    if (row.direction === "DEBIT") current.debit = current.debit.plus(amount);
    if (row.direction === "CREDIT") current.credit = current.credit.plus(amount);
    transactionSums.set(row.accountId, current);
  }

  const unpostedSums = new Map();
  for (const movement of unpostedMovements) {
    const accountId = movement.moneyAccount?.ledgerAccountId;
    if (!accountId) continue;
    const current = unpostedSums.get(accountId) || new Prisma.Decimal(0);
    const signed =
      movement.direction === "IN"
        ? new Prisma.Decimal(movement.amount)
        : new Prisma.Decimal(movement.amount).times(-1);
    unpostedSums.set(accountId, current.plus(signed));
  }

  const rows = accounts.map((account) => {
    const transactionSum = transactionSums.get(account.id) || {
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(0),
    };
    const openingBalance = account.moneyAccounts.reduce(
      (sum, moneyAccount) =>
        sum.plus(moneyAccount.openingBalance || new Prisma.Decimal(0)),
      new Prisma.Decimal(0)
    );
    const unpostedBalance = unpostedSums.get(account.id) || new Prisma.Decimal(0);
    const computedBalance = openingBalance
      .plus(transactionSum.debit)
      .minus(transactionSum.credit)
      .plus(unpostedBalance);
    const primaryMoneyAccount = account.moneyAccounts[0] || null;

    return {
      id: account.id,
      number: account.number,
      label: account.label,
      type: classifyTreasuryAccount(account.number),
      currency: primaryMoneyAccount?.currency || null,
      openingBalance: openingBalance.toString(),
      debit: transactionSum.debit.toString(),
      credit: transactionSum.credit.toString(),
      unpostedBalance: unpostedBalance.toString(),
      computedBalance: computedBalance.toString(),
      computedBalanceNumber: decimalToNumber(computedBalance),
      moneyAccountId: primaryMoneyAccount?.id || null,
      moneyAccountType: primaryMoneyAccount?.type || null,
      moneyAccountLabel: primaryMoneyAccount?.label || null,
      isActive: primaryMoneyAccount ? primaryMoneyAccount.isActive : true,
    };
  });
  if (includeUnused) return rows;
  return rows.filter((account) =>
    account.moneyAccountId ||
    hasMaterialAmount(account.openingBalance) ||
    hasMaterialAmount(account.debit) ||
    hasMaterialAmount(account.credit) ||
    hasMaterialAmount(account.unpostedBalance) ||
    hasMaterialAmount(account.computedBalance)
  );
}

export async function summarizeRecentTreasuryTransactions(companyId, since) {
  if (!companyId) throw new Error("companyId requis");
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: since },
      account: treasuryAccountWhere(companyId),
    },
    select: {
      amount: true,
      direction: true,
    },
  });

  const net = transactions.reduce((sum, transaction) => {
    const amount = decimalToNumber(transaction.amount);
    return transaction.direction === "DEBIT" ? sum + amount : sum - amount;
  }, 0);

  return { count: transactions.length, net };
}
