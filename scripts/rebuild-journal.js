#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { nextSequence } from '../src/lib/sequence.js';

const prisma = new PrismaClient();
const EPSILON = 0.000001;

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const companyId = getValue('--companyId') || null;
  const all = args.includes('--all');
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run') || !apply;
  if (!companyId && !all) {
    throw new Error('Usage: node scripts/rebuild-journal.js --companyId <id> [--apply|--dry-run] ou --all [--apply|--dry-run]');
  }
  return { companyId, all, apply, dryRun };
}

function groupKeyForTransaction(t) {
  return [
    t.companyId || 'NO_COMPANY',
    t.invoiceId || '',
    t.incomingInvoiceId || '',
    t.moneyMovementId || '',
    t.date.toISOString().slice(0, 10),
    t.nature || '',
  ].join('|');
}

function deriveSource(sample) {
  if (sample.invoiceId) return { sourceType: 'INVOICE', sourceId: sample.invoiceId };
  if (sample.incomingInvoiceId) return { sourceType: 'INCOMING_INVOICE', sourceId: sample.incomingInvoiceId };
  if (sample.moneyMovementId) return { sourceType: 'MONEY_MOVEMENT', sourceId: sample.moneyMovementId };
  return { sourceType: 'OTHER', sourceId: null };
}

function summarizeGroups(txs) {
  const groups = new Map();
  for (const tx of txs) {
    const key = groupKeyForTransaction(tx);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }

  const summaries = [];
  for (const [key, list] of groups.entries()) {
    let debit = 0;
    let credit = 0;
    for (const row of list) {
      const amount = Number(row.amount);
      if (row.direction === 'DEBIT') debit += amount;
      else if (row.direction === 'CREDIT') credit += amount;
    }
    const sample = list[0];
    summaries.push({
      key,
      companyId: sample.companyId || null,
      transactionIds: list.map((item) => item.id),
      count: list.length,
      date: sample.date,
      debit,
      credit,
      balanced: Math.abs(debit - credit) <= EPSILON,
      ...deriveSource(sample),
    });
  }
  return summaries.sort((a, b) => a.date - b.date || a.key.localeCompare(b.key));
}

async function resolveCompanies({ companyId, all }) {
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
    if (!company) throw new Error(`companyId introuvable: ${companyId}`);
    return [company];
  }
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  if (!all || !companies.length) return companies;
  return companies;
}

async function processCompany(company, dryRun) {
  const txs = await prisma.transaction.findMany({
    where: { companyId: company.id },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      companyId: true,
      date: true,
      nature: true,
      amount: true,
      direction: true,
      invoiceId: true,
      incomingInvoiceId: true,
      moneyMovementId: true,
    },
  });

  const summaries = summarizeGroups(txs);
  const unbalanced = summaries.filter((item) => !item.balanced);
  const balanced = summaries.filter((item) => item.balanced);

  const report = {
    companyId: company.id,
    companyName: company.name,
    transactions: txs.length,
    groups: summaries.length,
    balancedGroups: balanced.length,
    unbalancedGroups: unbalanced.length,
    skippedExamples: unbalanced.slice(0, 10).map((item) => ({
      key: item.key,
      debit: item.debit.toFixed(2),
      credit: item.credit.toFixed(2),
      count: item.count,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
    })),
  };

  if (dryRun) return report;

  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { companyId: company.id, journalEntryId: { not: null } },
      data: { journalEntryId: null },
    });
    await tx.journalEntry.deleteMany({ where: { companyId: company.id } });

    for (const group of balanced) {
      const number = await nextSequence(tx, 'JRN', 'JRN-', company.id);
      const je = await tx.journalEntry.create({
        data: {
          companyId: company.id,
          number,
          date: group.date,
          sourceType: group.sourceType,
          sourceId: group.sourceId,
          status: 'POSTED',
        },
      });
      await tx.transaction.updateMany({
        where: { id: { in: group.transactionIds }, companyId: company.id },
        data: { journalEntryId: je.id },
      });
    }
  });

  return report;
}

async function main() {
  const { companyId, all, dryRun } = parseArgs(process.argv);
  const companies = await resolveCompanies({ companyId, all });

  console.log(`Rebuilding journal (${dryRun ? 'dry-run' : 'apply'})...`);
  const reports = [];
  for (const company of companies) {
    const report = await processCompany(company, dryRun);
    reports.push(report);
    console.log(
      `- ${report.companyName} (${report.companyId}) | tx=${report.transactions} groups=${report.groups} balanced=${report.balancedGroups} unbalanced=${report.unbalancedGroups}`
    );
    for (const example of report.skippedExamples) {
      console.log(
        `  SKIP ${example.key} debit=${example.debit} credit=${example.credit} count=${example.count} source=${example.sourceType}:${example.sourceId || ''}`
      );
    }
  }

  if (dryRun) {
    console.log('Dry-run complete. Re-run with --apply to modify data.');
  } else {
    console.log('Rebuild complete.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
