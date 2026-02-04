import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { requireCompanyId } from "@/lib/tenant";

// Utilitaire conversion Decimal
function toNumber(val) {
  return val?.toNumber?.() ?? 0;
}

export async function GET(req) {
  const companyId = requireCompanyId(req);
  // Récupère tous les comptes de trésorerie (MoneyAccount)
  const accounts = await prisma.moneyAccount.findMany({
    where: { companyId },
    select: { id: true }
  });
  const accountIds = accounts.map(a => a.id);

  // Récupère tous les mouvements de trésorerie
  const movements = await prisma.moneyMovement.findMany({
    where: { moneyAccountId: { in: accountIds }, companyId },
    select: { amount: true, createdAt: true, moneyAccountId: true }
  });

  // Calcul du solde par compte
  const balances = {};
  for (const mv of movements) {
    const amt = toNumber(mv.amount);
    balances[mv.moneyAccountId] = (balances[mv.moneyAccountId] ?? 0) + amt;
  }
  const balanceList = Object.values(balances);

  // Solde global
  const balance = balanceList.reduce((a, b) => a + b, 0);
  // Solde max/min
  const max = balanceList.length ? Math.max(...balanceList) : 0;
  const min = balanceList.length ? Math.min(...balanceList) : 0;

  // Mouvements récents (7 derniers jours)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentCount = movements.filter(mv => mv.createdAt >= sevenDaysAgo).length;

  return Response.json({
    balance,
    accounts: accountIds.length,
    max,
    min,
    recentCount
  });
}
