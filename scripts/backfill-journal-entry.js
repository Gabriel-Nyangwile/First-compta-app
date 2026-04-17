#!/usr/bin/env node
/**
 * Backfill tenant-safe:
 * - only processes transactions without journalEntryId
 * - groups strictly inside one company
 * - creates JournalEntry numbers via Sequence per company
 *
 * Usage:
 *   node scripts/backfill-journal-entry.js --companyId <id> [--apply|--dry-run]
 *   node scripts/backfill-journal-entry.js --all [--apply|--dry-run]
 */
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
    throw new Error('Usage: node scripts/backfill-journal-entry.js --companyId <id> [--apply|--dry-run] ou --all [--apply|--dry-run]');
  }
  return { companyId, all, dryRun };
}

function deriveGroupKey(t) {
  const sourceKey =
    t.invoiceId ||
    t.incomingInvoiceId ||
    t.moneyMovementId ||
    `MISC:${t.date.toISOString().slice(0, 10)}:${t.nature}`;
  return `${t.companyId || 'NO_COMPANY'}|${sourceKey}`;
}

function deriveSource(sample) {
  if (sample.invoiceId) return { sourceType: 'INVOICE', sourceId: sample.invoiceId };
  if (sample.incomingInvoiceId) return { sourceType: 'INCOMING_INVOICE', sourceId: sample.incomingInvoiceId };
  if (sample.moneyMovementId) return { sourceType: 'MONEY_MOVEMENT', sourceId: sample.moneyMovementId };
  return { sourceType: 'OTHER', sourceId: null };
}

async function resolveCompanies({ companyId, all }) {
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
    if (!company) throw new Error(`companyId introuvable: ${companyId}`);
    return [company];
  }
  if (!all) return [];
  return prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

async function collectOrphans(companyId) {
  return prisma.transaction.findMany({
    where: {
      companyId,
      journalEntryId: null,
    },
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
}

function buildGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = deriveGroupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
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
      companyId: sample.companyId,
      transactionIds: list.map((item) => item.id),
      date: sample.date,
      count: list.length,
      debit,
      credit,
      balanced: Math.abs(debit - credit) <= EPSILON,
      ...deriveSource(sample),
    });
  }
  return summaries.sort((a, b) => a.date - b.date || a.key.localeCompare(b.key));
}

async function processCompany(company, dryRun) {
  const orphanRows = await collectOrphans(company.id);
  const groups = buildGroups(orphanRows);
  const balancedGroups = groups.filter((item) => item.balanced);
  const unbalancedGroups = groups.filter((item) => !item.balanced);

  const report = {
    companyId: company.id,
    companyName: company.name,
    orphanTransactions: orphanRows.length,
    groups: groups.length,
    creatableGroups: balancedGroups.length,
    skippedGroups: unbalancedGroups.length,
    skippedExamples: unbalancedGroups.slice(0, 10).map((item) => ({
      key: item.key,
      debit: item.debit.toFixed(2),
      credit: item.credit.toFixed(2),
      count: item.count,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
    })),
  };

  if (dryRun || !balancedGroups.length) return report;

  await prisma.$transaction(async (tx) => {
    for (const group of balancedGroups) {
      const existing = await tx.journalEntry.findFirst({
        where: {
          companyId: company.id,
          sourceType: group.sourceType,
          sourceId: group.sourceId,
          ...(group.sourceType === 'OTHER' ? { date: group.date } : {}),
        },
        select: { id: true },
      });

      let journalEntryId = existing?.id || null;
      if (!journalEntryId) {
        const number = await nextSequence(tx, 'JRN', 'JRN-', company.id);
        const created = await tx.journalEntry.create({
          data: {
            companyId: company.id,
            number,
            sourceType: group.sourceType,
            sourceId: group.sourceId,
            date: group.date,
            status: 'POSTED',
          },
          select: { id: true },
        });
        journalEntryId = created.id;
      }

      await tx.transaction.updateMany({
        where: {
          id: { in: group.transactionIds },
          companyId: company.id,
          journalEntryId: null,
        },
        data: { journalEntryId },
      });
    }
  });

  return report;
}

async function main() {
  const { companyId, all, dryRun } = parseArgs(process.argv);
  const companies = await resolveCompanies({ companyId, all });

  console.log(`Starting journal backfill (${dryRun ? 'dry-run' : 'apply'})...`);
  for (const company of companies) {
    const report = await processCompany(company, dryRun);
    console.log(
      `- ${report.companyName} (${report.companyId}) | orphanTx=${report.orphanTransactions} groups=${report.groups} creatable=${report.creatableGroups} skipped=${report.skippedGroups}`
    );
    for (const example of report.skippedExamples) {
      console.log(
        `  SKIP ${example.key} debit=${example.debit} credit=${example.credit} count=${example.count} source=${example.sourceType}:${example.sourceId || ''}`
      );
    }
  }
  if (dryRun) console.log('Dry-run complete. Re-run with --apply to modify data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
