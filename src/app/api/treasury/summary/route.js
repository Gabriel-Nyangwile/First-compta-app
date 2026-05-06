import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";
import { getMissionAdvanceOverview } from "@/lib/serverActions/money";
import {
  listTreasuryLedgerAccountsWithBalance,
  summarizeRecentTreasuryTransactions,
} from "@/lib/treasuryAccounts";

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

  const [treasuryAccounts, supplierPayments, missionAdvanceOverview] = await Promise.all([
    listTreasuryLedgerAccountsWithBalance(companyId),
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

  const balanceList = treasuryAccounts.map((account) =>
    toNumber(account.computedBalance)
  );
  const balance = balanceList.reduce((sum, value) => sum + value, 0);
  const max = balanceList.length ? Math.max(...balanceList) : 0;
  const min = balanceList.length ? Math.min(...balanceList) : 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = await summarizeRecentTreasuryTransactions(companyId, sevenDaysAgo);

  const negativeCashAccounts = treasuryAccounts
    .filter((account) => account.type === "CASH")
    .map((account) => ({
      id: account.id,
      number: account.number,
      balance: toNumber(account.computedBalance),
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
    accounts: treasuryAccounts.length,
    max,
    min,
    recentCount: recent.count,
    recentNet: recent.net,
    openingBalanceTotal: treasuryAccounts.reduce(
      (sum, account) => sum + toNumber(account.openingBalance),
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
