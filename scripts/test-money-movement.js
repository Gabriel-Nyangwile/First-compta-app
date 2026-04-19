import prisma from "../src/lib/prisma.js";
import { Prisma } from "@prisma/client";
import {
  computeMoneyAccountBalance,
  createMoneyMovement,
} from "../src/lib/serverActions/money.js";

async function main() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!company) throw new Error("Aucune société disponible");

  const suffix = Date.now().toString().slice(-6);
  const ledgerAccount = await prisma.account.create({
    data: {
      companyId: company.id,
      number: `571${suffix}`,
      label: `Caisse test ${suffix}`,
    },
  });
  const expenseAccount = await prisma.account.create({
    data: {
      companyId: company.id,
      number: `625${suffix}`,
      label: `Frais mission ${suffix}`,
    },
  });
  const advanceAccount = await prisma.account.create({
    data: {
      companyId: company.id,
      number: `425${suffix}`,
      label: `Avances personnel ${suffix}`,
    },
  });
  const moneyAccount = await prisma.moneyAccount.create({
    data: {
      companyId: company.id,
      type: "CASH",
      label: `Caisse test ${suffix}`,
      openingBalance: new Prisma.Decimal(500),
      ledgerAccountId: ledgerAccount.id,
    },
  });
  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      firstName: "Test",
      lastName: `Mission ${suffix}`,
      employeeNumber: `TMP-${suffix}`,
      status: "ACTIVE",
    },
  });

  const expenseMovement = await createMoneyMovement({
    companyId: company.id,
    moneyAccountId: moneyAccount.id,
    amount: 40,
    direction: "OUT",
    kind: "EMPLOYEE_EXPENSE",
    description: "Remboursement de frais de mission",
    employeeId: employee.id,
    supportRef: `NF-${suffix}`,
    counterpartAccountId: expenseAccount.id,
  });
  const advanceMovement = await createMoneyMovement({
    companyId: company.id,
    moneyAccountId: moneyAccount.id,
    amount: 60,
    direction: "OUT",
    kind: "MISSION_ADVANCE",
    description: "Avance mission terrain",
    employeeId: employee.id,
    supportRef: `OM-${suffix}`,
    counterpartAccountId: advanceAccount.id,
  });

  const balance = await computeMoneyAccountBalance(moneyAccount.id, company.id);
  const movements = await prisma.moneyMovement.findMany({
    where: { id: { in: [expenseMovement.id, advanceMovement.id] }, companyId: company.id },
    include: {
      transactions: true,
      employee: { select: { employeeNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (movements.length !== 2) {
    throw new Error(`2 mouvements attendus, obtenu ${movements.length}`);
  }
  for (const movement of movements) {
    if (!movement.employeeId) {
      throw new Error(`employeeId manquant sur ${movement.kind}`);
    }
    if (!movement.supportRef) {
      throw new Error(`supportRef manquant sur ${movement.kind}`);
    }
    if (movement.transactions.length !== 2) {
      throw new Error(
        `${movement.kind} devrait générer 2 transactions, obtenu ${movement.transactions.length}`
      );
    }
  }
  if (!balance.eq(new Prisma.Decimal(400))) {
    throw new Error(`Solde attendu 400, obtenu ${balance.toString()}`);
  }

  console.log("test-money-movement: OK");
  console.log(
    JSON.stringify(
      {
        company: company.name,
        employee: employee.employeeNumber,
        balance: balance.toString(),
        movements: movements.map((movement) => ({
          id: movement.id,
          kind: movement.kind,
          supportRef: movement.supportRef,
          transactionCount: movement.transactions.length,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("test-money-movement: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
