import prisma from "../src/lib/prisma.js";
import { Prisma } from "@prisma/client";
import {
  createMissionAdvanceRegularization,
  createMoneyMovement,
  listOpenMissionAdvances,
} from "../src/lib/serverActions/money.js";

async function main() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Aucune société disponible");

  const suffix = Date.now().toString().slice(-6);
  const cashLedger = await prisma.account.create({
    data: { companyId: company.id, number: `571R${suffix}`, label: `Caisse reg ${suffix}` },
  });
  const advanceAccount = await prisma.account.create({
    data: { companyId: company.id, number: `425R${suffix}`, label: `Avance mission ${suffix}` },
  });
  const expenseAccount = await prisma.account.create({
    data: { companyId: company.id, number: `625R${suffix}`, label: `Charge mission ${suffix}` },
  });
  const moneyAccount = await prisma.moneyAccount.create({
    data: {
      companyId: company.id,
      type: "CASH",
      label: `Caisse reg ${suffix}`,
      openingBalance: new Prisma.Decimal(300),
      ledgerAccountId: cashLedger.id,
    },
  });
  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      firstName: "Regularisation",
      lastName: `Test ${suffix}`,
      employeeNumber: `REG-${suffix}`,
      status: "ACTIVE",
    },
  });

  const advance = await createMoneyMovement({
    companyId: company.id,
    moneyAccountId: moneyAccount.id,
    amount: 120,
    direction: "OUT",
    kind: "MISSION_ADVANCE",
    description: "Avance mission test",
    employeeId: employee.id,
    supportRef: `OM-${suffix}`,
    counterpartAccountId: advanceAccount.id,
  });

  const before = await listOpenMissionAdvances({
    companyId: company.id,
    employeeId: employee.id,
  });
  const beforeAdvance = before.find((row) => row.id === advance.id);
  if (!beforeAdvance) throw new Error("Avance ouverte introuvable avant régularisation");

  const regularization = await createMissionAdvanceRegularization({
    companyId: company.id,
    advanceMovementId: advance.id,
    expenseAccountId: expenseAccount.id,
    amount: 70,
    supportRef: `NF-${suffix}`,
    description: "Note de frais test",
  });

  const after = await listOpenMissionAdvances({
    companyId: company.id,
    employeeId: employee.id,
  });
  const afterAdvance = after.find((row) => row.id === advance.id);
  if (!afterAdvance) throw new Error("Avance ouverte introuvable après régularisation");
  if (Math.abs(afterAdvance.remainingAmount - 50) > 0.01) {
    throw new Error(`Reliquat attendu 50, obtenu ${afterAdvance.remainingAmount}`);
  }

  const journal = await prisma.journalEntry.findUnique({
    where: { id: regularization.journalEntryId },
    include: { lines: true },
  });
  if (!journal || journal.lines.length !== 2) {
    throw new Error("Journal de régularisation introuvable ou incomplet");
  }

  console.log("test-mission-advance-regularization: OK");
  console.log(
    JSON.stringify(
      {
        company: company.name,
        employee: employee.employeeNumber,
        advanceVoucherRef: advance.voucherRef,
        beforeRemaining: beforeAdvance.remainingAmount,
        afterRemaining: afterAdvance.remainingAmount,
        journalNumber: journal.number,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("test-mission-advance-regularization: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
