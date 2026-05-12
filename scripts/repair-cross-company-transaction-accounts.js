#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

function parseArgs(argv) {
  const args = {
    apply: false,
    company: null,
    companyId: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry" || arg === "--dry-run") args.apply = false;
    else if (arg === "--company" || arg === "--companyId") args[arg.slice(2)] = argv[++i] || "";
    else if (arg.startsWith("--company=")) args.company = arg.slice("--company=".length);
    else if (arg.startsWith("--companyId=")) args.companyId = arg.slice("--companyId=".length);
    else throw new Error(`Option inconnue: ${arg}`);
  }

  return args;
}

async function resolveCompanyId(args) {
  if (args.companyId) return args.companyId;
  if (!args.company) return null;

  const company = await prisma.company.findFirst({
    where: { name: args.company },
    select: { id: true },
  });
  if (!company) throw new Error(`Societe introuvable: ${args.company}`);
  return company.id;
}

async function collectRepairs(companyId = null) {
  const transactions = await prisma.transaction.findMany({
    where: companyId ? { companyId } : {},
    select: {
      id: true,
      companyId: true,
      description: true,
      kind: true,
      accountId: true,
      account: {
        select: {
          id: true,
          companyId: true,
          number: true,
          label: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const repairs = [];
  const missingTargets = [];
  const targetCache = new Map();

  for (const transaction of transactions) {
    if (!transaction.account || transaction.account.companyId === transaction.companyId) continue;

    const cacheKey = `${transaction.companyId}:${transaction.account.number}`;
    let targetAccount = targetCache.get(cacheKey);
    if (targetAccount === undefined) {
      targetAccount = await prisma.account.findFirst({
        where: {
          companyId: transaction.companyId,
          number: transaction.account.number,
        },
        select: { id: true, companyId: true, number: true, label: true },
      });
      targetCache.set(cacheKey, targetAccount || null);
    }

    const row = {
      transaction,
      sourceAccount: transaction.account,
      targetAccount,
    };

    if (targetAccount) repairs.push(row);
    else missingTargets.push(row);
  }

  return { repairs, missingTargets };
}

async function applyRepairs(repairs) {
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const repair of repairs) {
      await tx.transaction.update({
        where: { id: repair.transaction.id },
        data: { accountId: repair.targetAccount.id },
      });
      updated += 1;
    }
  });
  return updated;
}

function printRepair(repair) {
  const tx = repair.transaction;
  const source = repair.sourceAccount;
  const target = repair.targetAccount;
  console.log(
    `- tx=${tx.id} company=${tx.companyId} kind=${tx.kind} account ${source.number}: ${source.companyId}/${source.id} -> ${target.companyId}/${target.id}`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companyId = await resolveCompanyId(args);
  const { repairs, missingTargets } = await collectRepairs(companyId);

  console.log(`[repair-cross-company-transaction-accounts] Reparations possibles: ${repairs.length}`);
  for (const repair of repairs) printRepair(repair);

  if (missingTargets.length) {
    console.log(`[repair-cross-company-transaction-accounts] Comptes cibles manquants: ${missingTargets.length}`);
    for (const row of missingTargets) {
      console.log(
        `- tx=${row.transaction.id} company=${row.transaction.companyId} compte manquant=${row.sourceAccount.number}`
      );
    }
  }

  if (!repairs.length) return;
  if (!args.apply) {
    console.log("[repair-cross-company-transaction-accounts] Dry-run uniquement. Relancer avec --apply.");
    return;
  }

  const updated = await applyRepairs(repairs);
  console.log(`[repair-cross-company-transaction-accounts] Transactions mises a jour: ${updated}`);
}

main()
  .catch((error) => {
    console.error("[repair-cross-company-transaction-accounts] Echec:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
