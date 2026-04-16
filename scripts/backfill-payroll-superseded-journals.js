#!/usr/bin/env node

import prisma from '../src/lib/prisma.js';
import { isBasePayrollJournal, isPayrollReversalDescription, listPayrollJournals } from '../src/lib/payroll/journals.js';

const APPLY = process.argv.includes('--apply');

function extractReversedJournalNumber(description) {
  const match = description?.match(/reversal\s+(JRN-\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

async function main() {
  const periods = await prisma.payrollPeriod.findMany({
    select: { id: true, ref: true, companyId: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  const targets = [];
  for (const period of periods) {
    const journals = await listPayrollJournals(prisma, period.id, period.companyId, {
      id: true,
      number: true,
      date: true,
      description: true,
      sourceId: true,
      companyId: true,
    });
    const baseJournals = journals.filter((journal) => isBasePayrollJournal(journal));
    if (baseJournals.length <= 1) continue;
    const currentJournal = baseJournals[0];
    const reversals = journals.filter((journal) => isPayrollReversalDescription(journal.description));
    for (const supersededJournal of baseJournals.slice(1)) {
      const reversal = reversals.find(
        (journal) => extractReversedJournalNumber(journal.description) === supersededJournal.number.toUpperCase()
      );
      if (!reversal) continue;
      targets.push({
        period,
        currentJournal,
        supersededJournal,
        reversal,
      });
    }
  }

  console.log(JSON.stringify({
    apply: APPLY,
    targets: targets.map((item) => ({
      periodRef: item.period.ref,
      companyId: item.period.companyId,
      detachJournal: item.supersededJournal.number,
      reversalJournal: item.reversal.number,
      currentJournal: item.currentJournal.number,
    })),
  }, null, 2));

  if (!APPLY || !targets.length) return;

  for (const item of targets) {
    await prisma.journalEntry.update({
      where: { id: item.supersededJournal.id },
      data: { sourceId: null },
    });
  }

  console.log(`Detached ${targets.length} superseded payroll journal(s).`);
}

main().catch((error) => {
  console.error('[backfill-payroll-superseded-journals] failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});