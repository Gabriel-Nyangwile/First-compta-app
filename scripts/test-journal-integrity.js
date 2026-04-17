#!/usr/bin/env node
/**
 * Simple integrity test: verify every JournalEntry is balanced (sum debit == sum credit)
 * and report any orphan transaction without a journalEntryId.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const EPSILON = 0.000001;

function parseArgs(argv) {
  const args = argv.slice(2);
  const idx = args.indexOf('--companyId');
  return {
    companyId: idx >= 0 ? args[idx + 1] : null,
  };
}

async function main() {
  const { companyId } = parseArgs(process.argv);
  const scope = companyId ? { companyId } : {};
  console.log('Checking journal integrity...');
  if (companyId) console.log(`Scope companyId=${companyId}`);
  const entries = await prisma.journalEntry.findMany({
    where: scope,
    include: { lines: true },
    orderBy: { date: 'asc' },
  });
  let unbalanced = 0;
  let empty = 0;
  for (const e of entries) {
    let d = 0; let c = 0;
    if (!e.lines.length) {
      console.log(`EMPTY ${e.number} (id=${e.id})`);
      empty++;
      continue;
    }
    for (const l of e.lines) {
      const amt = Number(l.amount);
      if (l.direction === 'DEBIT') d += amt; else if (l.direction === 'CREDIT') c += amt;
    }
    if (Math.abs(d - c) > EPSILON) {
      console.log(`UNBALANCED ${e.number} debit=${d} credit=${c} (id=${e.id})`);
      unbalanced++;
    }
  }
  const orphanCount = await prisma.transaction.count({ where: { ...scope, journalEntryId: null } });
  console.log(`Entries: ${entries.length}, Empty: ${empty}, Unbalanced: ${unbalanced}, Orphan transactions: ${orphanCount}`);
  if (unbalanced === 0 && orphanCount === 0 && empty === 0) {
    console.log('Journal integrity OK.');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
