import prisma from "../src/lib/prisma.js";
import { getMissionAdvanceOverview } from "../src/lib/serverActions/money.js";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const report = [];
  let failures = 0;

  for (const company of companies) {
    const [cashAccounts, supplierPayments, missionAdvanceOverview] = await Promise.all([
      prisma.moneyAccount.findMany({
        where: { companyId: company.id, type: "CASH" },
        include: {
          movements: {
            select: { amount: true, direction: true },
          },
        },
      }),
      prisma.moneyMovement.findMany({
        where: {
          companyId: company.id,
          kind: "SUPPLIER_PAYMENT",
          direction: "OUT",
        },
        select: {
          id: true,
          voucherRef: true,
          transactions: { select: { letterStatus: true } },
        },
      }),
      getMissionAdvanceOverview({ companyId: company.id }),
    ]);

    const negativeCash = cashAccounts.filter((account) => {
      const opening = toNumber(account.openingBalance);
      const delta = (account.movements || []).reduce((sum, movement) => {
        const amount = toNumber(movement.amount);
        return movement.direction === "IN" ? sum + amount : sum - amount;
      }, 0);
      return opening + delta < -0.009;
    });

    const unmatchedSupplierPayments = supplierPayments.filter((movement) => {
      const statuses = (movement.transactions || []).map(
        (tx) => tx.letterStatus || "UNMATCHED"
      );
      return !statuses.length || statuses.some((status) => status !== "MATCHED");
    });

    const criticalAdvances = missionAdvanceOverview.rows.filter(
      (row) => row.ageDays > 90
    );

    if (negativeCash.length) failures += 1;
    if (criticalAdvances.length) failures += 1;

    report.push({
      company: company.name,
      negativeCashCount: negativeCash.length,
      unmatchedSupplierPaymentsCount: unmatchedSupplierPayments.length,
      openMissionAdvancesCount: missionAdvanceOverview.summary.totalOpenCount,
      criticalMissionAdvancesCount: criticalAdvances.length,
    });
  }

  console.log(JSON.stringify(report, null, 2));
  if (failures) process.exit(1);
}

main()
  .catch((error) => {
    console.error("test-treasury-recipe: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
