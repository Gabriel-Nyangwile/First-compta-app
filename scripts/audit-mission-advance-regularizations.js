import prisma from "../src/lib/prisma.js";

async function main() {
  const rows = await prisma.missionAdvanceRegularization.findMany({
    include: {
      employee: { select: { companyId: true, employeeNumber: true } },
      expenseAccount: { select: { companyId: true, number: true } },
      advanceMovement: {
        select: {
          companyId: true,
          kind: true,
          employeeId: true,
          amount: true,
          regularizations: { select: { amount: true } },
        },
      },
      journalEntry: { select: { id: true, number: true } },
    },
  });

  const issues = [];
  for (const row of rows) {
    if (row.advanceMovement.kind !== "MISSION_ADVANCE") {
      issues.push({ id: row.id, issue: "advanceMovement non MISSION_ADVANCE" });
    }
    if (row.employee.companyId !== row.companyId || row.advanceMovement.companyId !== row.companyId) {
      issues.push({ id: row.id, issue: "Société incohérente" });
    }
    if (row.expenseAccount.companyId !== row.companyId) {
      issues.push({ id: row.id, issue: "Compte de charge hors société" });
    }
    if (!row.expenseAccount.number?.startsWith("6")) {
      issues.push({ id: row.id, issue: `Compte de charge ${row.expenseAccount.number || "?"} hors classe 6` });
    }
    if (!row.journalEntryId) {
      issues.push({ id: row.id, issue: "journalEntryId manquant" });
    }
    const settled = row.advanceMovement.regularizations.reduce(
      (sum, regularization) => sum + Number(regularization.amount?.toString?.() ?? regularization.amount ?? 0),
      0
    );
    const advanceAmount = Number(row.advanceMovement.amount?.toString?.() ?? row.advanceMovement.amount ?? 0);
    if (settled - advanceAmount > 0.01) {
      issues.push({ id: row.id, issue: `Régularisations ${settled} > avance ${advanceAmount}` });
    }
  }

  console.log(JSON.stringify({ checked: rows.length, issues }, null, 2));
  if (issues.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error("audit-mission-advance-regularizations: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
