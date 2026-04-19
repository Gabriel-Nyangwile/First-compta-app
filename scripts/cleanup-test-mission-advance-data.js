#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const companyNameArg = args.find((arg) => arg.startsWith("--company="));
const companyName = companyNameArg
  ? companyNameArg.split("=").slice(1).join("=")
  : "Strategic Business Démo";

function isSyntheticMovement(movement) {
  const employeeNumber = movement.employee?.employeeNumber || "";
  return (
    employeeNumber.startsWith("TMP-") ||
    employeeNumber.startsWith("REG-") ||
    employeeNumber.startsWith("RFD-") ||
    /test/i.test(movement.description || "")
  );
}

async function main() {
  const company = await prisma.company.findFirst({
    where: { name: companyName },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`Société introuvable: ${companyName}`);

  const movements = await prisma.moneyMovement.findMany({
    where: {
      companyId: company.id,
      kind: { in: ["MISSION_ADVANCE", "MISSION_ADVANCE_REFUND"] },
    },
    include: {
      employee: { select: { id: true, employeeNumber: true } },
      regularizations: { select: { id: true, journalEntryId: true, expenseAccountId: true } },
      relatedRefundMovements: { select: { id: true, moneyAccountId: true } },
      transactions: { select: { id: true, journalEntryId: true, accountId: true } },
      moneyAccount: { select: { id: true, ledgerAccountId: true, label: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const targetMovements = movements.filter(isSyntheticMovement);
  const targetMovementIds = new Set(targetMovements.map((movement) => movement.id));
  for (const movement of targetMovements) {
    for (const refund of movement.relatedRefundMovements || []) {
      targetMovementIds.add(refund.id);
    }
  }

  const targetSet = new Set(targetMovementIds);
  const selectedMovements = movements.filter((movement) => targetSet.has(movement.id));

  const regularizationIds = new Set();
  const journalEntryIds = new Set();
  const employeeIds = new Set();
  const moneyAccountIds = new Set();
  const accountIds = new Set();

  for (const movement of selectedMovements) {
    if (movement.employeeId) employeeIds.add(movement.employeeId);
    if (movement.moneyAccountId) moneyAccountIds.add(movement.moneyAccountId);
    if (movement.moneyAccount?.ledgerAccountId) accountIds.add(movement.moneyAccount.ledgerAccountId);
    for (const tx of movement.transactions || []) {
      if (tx.journalEntryId) journalEntryIds.add(tx.journalEntryId);
      if (tx.accountId) accountIds.add(tx.accountId);
    }
    for (const regularization of movement.regularizations || []) {
      regularizationIds.add(regularization.id);
      if (regularization.journalEntryId) journalEntryIds.add(regularization.journalEntryId);
      if (regularization.expenseAccountId) accountIds.add(regularization.expenseAccountId);
    }
  }

  const plan = {
    company: company.name,
    movements: selectedMovements.map((movement) => ({
      id: movement.id,
      kind: movement.kind,
      voucherRef: movement.voucherRef,
      employeeNumber: movement.employee?.employeeNumber || null,
    })),
    deleteCounts: {
      movements: targetSet.size,
      regularizations: regularizationIds.size,
      journalEntries: journalEntryIds.size,
      employees: employeeIds.size,
      moneyAccounts: moneyAccountIds.size,
      candidateAccounts: accountIds.size,
    },
    mode: apply ? "apply" : "dry-run",
  };

  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    if (journalEntryIds.size) {
      await tx.transaction.deleteMany({
        where: { journalEntryId: { in: Array.from(journalEntryIds) }, companyId: company.id },
      });
    }
    if (regularizationIds.size) {
      await tx.missionAdvanceRegularization.deleteMany({
        where: { id: { in: Array.from(regularizationIds) }, companyId: company.id },
      });
    }
    if (targetSet.size) {
      await tx.moneyMovement.deleteMany({
        where: { id: { in: Array.from(targetSet) }, companyId: company.id },
      });
    }
    if (journalEntryIds.size) {
      await tx.journalEntry.deleteMany({
        where: { id: { in: Array.from(journalEntryIds) }, companyId: company.id },
      });
    }
  });

  for (const moneyAccountId of moneyAccountIds) {
    const remaining = await prisma.moneyMovement.count({
      where: { moneyAccountId, companyId: company.id },
    });
    if (remaining === 0) {
      try {
        await prisma.moneyAccount.delete({ where: { id: moneyAccountId } });
      } catch {}
    }
  }

  for (const employeeId of employeeIds) {
    const [movementCount, regularizationCount] = await Promise.all([
      prisma.moneyMovement.count({ where: { employeeId, companyId: company.id } }),
      prisma.missionAdvanceRegularization.count({ where: { employeeId, companyId: company.id } }),
    ]);
    if (movementCount === 0 && regularizationCount === 0) {
      try {
        await prisma.employee.delete({ where: { id: employeeId } });
      } catch {}
    }
  }

  for (const accountId of accountIds) {
    const txCount = await prisma.transaction.count({ where: { accountId, companyId: company.id } });
    const moneyAccountCount = await prisma.moneyAccount.count({ where: { ledgerAccountId: accountId, companyId: company.id } });
    const regularizationCount = await prisma.missionAdvanceRegularization.count({ where: { expenseAccountId: accountId, companyId: company.id } });
    if (txCount === 0 && moneyAccountCount === 0 && regularizationCount === 0) {
      try {
        await prisma.account.delete({ where: { id: accountId } });
      } catch {}
    }
  }

  const remainingOpen = await prisma.moneyMovement.count({
    where: { companyId: company.id, kind: "MISSION_ADVANCE" },
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        company: company.name,
        remainingMissionAdvanceCount: remainingOpen,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("cleanup-test-mission-advance-data: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
