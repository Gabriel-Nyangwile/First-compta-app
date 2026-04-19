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
  const cashOutLedger = await prisma.account.create({
    data: { companyId: company.id, number: `571F${suffix}`, label: `Caisse sortie ${suffix}` },
  });
  const cashInLedger = await prisma.account.create({
    data: { companyId: company.id, number: `521F${suffix}`, label: `Banque retour ${suffix}` },
  });
  const advanceAccount = await prisma.account.create({
    data: { companyId: company.id, number: `425F${suffix}`, label: `Avance mission ${suffix}` },
  });
  const expenseAccount = await prisma.account.create({
    data: { companyId: company.id, number: `625F${suffix}`, label: `Charge mission ${suffix}` },
  });
  const cashOut = await prisma.moneyAccount.create({
    data: {
      companyId: company.id,
      type: "CASH",
      label: `Caisse sortie ${suffix}`,
      openingBalance: new Prisma.Decimal(400),
      ledgerAccountId: cashOutLedger.id,
    },
  });
  const cashIn = await prisma.moneyAccount.create({
    data: {
      companyId: company.id,
      type: "BANK",
      label: `Banque retour ${suffix}`,
      openingBalance: new Prisma.Decimal(0),
      ledgerAccountId: cashInLedger.id,
    },
  });
  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      firstName: "Refund",
      lastName: `Mission ${suffix}`,
      employeeNumber: `RFD-${suffix}`,
      status: "ACTIVE",
    },
  });

  const advance = await createMoneyMovement({
    companyId: company.id,
    moneyAccountId: cashOut.id,
    amount: 100,
    direction: "OUT",
    kind: "MISSION_ADVANCE",
    description: "Avance à solder",
    employeeId: employee.id,
    supportRef: `OM-${suffix}`,
    counterpartAccountId: advanceAccount.id,
  });

  await createMissionAdvanceRegularization({
    companyId: company.id,
    advanceMovementId: advance.id,
    expenseAccountId: expenseAccount.id,
    amount: 60,
    supportRef: `NF-${suffix}`,
    description: "Note de frais partielle",
  });

  const beforeRefund = await listOpenMissionAdvances({
    companyId: company.id,
    employeeId: employee.id,
  });
  const openBefore = beforeRefund.find((row) => row.id === advance.id);
  if (!openBefore || Math.abs(openBefore.remainingAmount - 40) > 0.01) {
    throw new Error("Reliquat attendu avant remboursement = 40");
  }

  const refund = await createMoneyMovement({
    companyId: company.id,
    moneyAccountId: cashIn.id,
    amount: 40,
    direction: "IN",
    kind: "MISSION_ADVANCE_REFUND",
    description: "Remboursement reliquat mission",
    employeeId: employee.id,
    relatedAdvanceMovementId: advance.id,
    supportRef: `PCR-${suffix}`,
  });

  const afterRefund = await listOpenMissionAdvances({
    companyId: company.id,
    employeeId: employee.id,
  });
  if (afterRefund.some((row) => row.id === advance.id)) {
    throw new Error("L'avance devrait être soldée après remboursement");
  }

  const refundTransactions = await prisma.transaction.findMany({
    where: { moneyMovementId: refund.id },
    include: { account: true },
  });
  if (refundTransactions.length !== 2) {
    throw new Error("Le remboursement doit générer 2 écritures");
  }
  const creditAdvance = refundTransactions.find(
    (tx) => tx.direction === "CREDIT" && tx.account?.number === advanceAccount.number
  );
  if (!creditAdvance) {
    throw new Error("Le compte d'avance n'a pas été crédité");
  }

  console.log("test-mission-advance-refund: OK");
  console.log(
    JSON.stringify(
      {
        company: company.name,
        employee: employee.employeeNumber,
        advanceVoucherRef: advance.voucherRef,
        refundVoucherRef: refund.voucherRef,
        remainingBeforeRefund: openBefore.remainingAmount,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("test-mission-advance-refund: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
