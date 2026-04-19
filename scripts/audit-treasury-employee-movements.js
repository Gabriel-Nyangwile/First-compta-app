import prisma from "../src/lib/prisma.js";

const scopedKinds = ["EMPLOYEE_EXPENSE", "MISSION_ADVANCE", "PETTY_CASH_OUT"];

async function main() {
  const rows = await prisma.moneyMovement.findMany({
    where: { kind: { in: scopedKinds } },
    include: {
      employee: { select: { id: true, companyId: true, employeeNumber: true } },
      transactions: {
        include: { account: { select: { id: true, number: true, companyId: true } } },
      },
    },
    orderBy: [{ date: "desc" }],
  });

  const issues = [];
  for (const row of rows) {
    const txCount = row.transactions.length;
    if (txCount !== 2) {
      issues.push({
        id: row.id,
        kind: row.kind,
        issue: `Nombre de transactions attendu=2, obtenu=${txCount}`,
      });
    }
    if (row.kind === "MISSION_ADVANCE" && !row.employeeId) {
      issues.push({ id: row.id, kind: row.kind, issue: "employeeId requis" });
    }
    if (!row.employeeId && !row.beneficiaryLabel) {
      issues.push({
        id: row.id,
        kind: row.kind,
        issue: "employeeId ou beneficiaryLabel absent",
      });
    }
    if (row.employee && row.employee.companyId !== row.companyId) {
      issues.push({
        id: row.id,
        kind: row.kind,
        issue: "Employé rattaché à une autre société",
      });
    }
    if (row.kind === "MISSION_ADVANCE") {
      const counterpart = row.transactions.find((tx) => tx.direction === "DEBIT");
      if (counterpart?.account && !counterpart.account.number?.startsWith("4")) {
        issues.push({
          id: row.id,
          kind: row.kind,
          issue: `Compte contrepartie ${counterpart.account.number || "?"} hors classe 4`,
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        checked: rows.length,
        issues,
      },
      null,
      2
    )
  );
  if (issues.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error("audit-treasury-employee-movements: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
