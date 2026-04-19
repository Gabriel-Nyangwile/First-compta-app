import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";
import { getMissionAdvanceOverview } from "@/lib/serverActions/money";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

function isFullyMatched(transactions = []) {
  if (!transactions.length) return false;
  return transactions.every(
    (tx) => (tx.letterStatus || "UNMATCHED") === "MATCHED"
  );
}

export async function GET(req) {
  const companyId = requireCompanyId(req);

  const [accounts, supplierPayments, missionAdvanceOverview] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { companyId },
      select: {
        id: true,
        type: true,
        openingBalance: true,
      },
    }),
    prisma.moneyMovement.findMany({
      where: {
        companyId,
        kind: "SUPPLIER_PAYMENT",
        direction: "OUT",
      },
      select: {
        id: true,
        amount: true,
        transactions: {
          select: {
            id: true,
            letterStatus: true,
          },
        },
      },
    }),
    getMissionAdvanceOverview({ companyId }),
  ]);

  const accountIds = accounts.map((account) => account.id);
  const openingBalances = new Map(
    accounts.map((account) => [account.id, toNumber(account.openingBalance)])
  );
  const movements = await prisma.moneyMovement.findMany({
    where: { moneyAccountId: { in: accountIds }, companyId },
    select: {
      amount: true,
      direction: true,
      createdAt: true,
      moneyAccountId: true,
    },
  });

  const balances = new Map(
    accounts.map((account) => [account.id, toNumber(account.openingBalance)])
  );
  for (const movement of movements) {
    const signedAmount =
      movement.direction === "IN"
        ? toNumber(movement.amount)
        : -toNumber(movement.amount);
    balances.set(
      movement.moneyAccountId,
      (balances.get(movement.moneyAccountId) || 0) + signedAmount
    );
  }

  const balanceList = [...balances.values()];
  const balance = balanceList.reduce((sum, value) => sum + value, 0);
  const max = balanceList.length ? Math.max(...balanceList) : 0;
  const min = balanceList.length ? Math.min(...balanceList) : 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentMovements = movements.filter((movement) => movement.createdAt >= sevenDaysAgo);
  const recentCount = recentMovements.length;
  const recentNet = recentMovements.reduce((sum, movement) => {
    const signedAmount =
      movement.direction === "IN"
        ? toNumber(movement.amount)
        : -toNumber(movement.amount);
    return sum + signedAmount;
  }, 0);

  const negativeCashAccounts = accounts
    .filter((account) => account.type === "CASH")
    .map((account) => ({
      id: account.id,
      balance: balances.get(account.id) || 0,
    }))
    .filter((account) => account.balance < -0.009);

  const unmatchedSupplierPayments = supplierPayments.filter(
    (payment) => !isFullyMatched(payment.transactions)
  );
  const unmatchedSupplierPaymentsAmount = unmatchedSupplierPayments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0
  );

  return Response.json({
    balance,
    accounts: accountIds.length,
    max,
    min,
    recentCount,
    recentNet,
    openingBalanceTotal: [...openingBalances.values()].reduce(
      (sum, value) => sum + value,
      0
    ),
    negativeCashAccountsCount: negativeCashAccounts.length,
    unmatchedSupplierPaymentsCount: unmatchedSupplierPayments.length,
    unmatchedSupplierPaymentsAmount,
    openMissionAdvancesCount: missionAdvanceOverview.summary.totalOpenCount,
    openMissionAdvancesAmount: missionAdvanceOverview.summary.totalOpenAmount,
    openMissionAdvancesCriticalCount:
      missionAdvanceOverview.rows.filter((row) => row.ageDays > 90).length,
    warnings: {
      negativeCashAccounts: negativeCashAccounts.length,
      unmatchedSupplierPayments: unmatchedSupplierPayments.length,
      openMissionAdvances: missionAdvanceOverview.summary.totalOpenCount,
    },
  });
}
