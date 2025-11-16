#!/usr/bin/env node
/**
 * Simple integrity test: verify every JournalEntry is balanced (sum debit == sum credit)
 * and report any orphan transaction without a journalEntryId.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Checking journal integrity...');
  const entries = await prisma.journalEntry.findMany({ include: { lines: true }, orderBy: { date: 'asc' } });
  let unbalanced = 0;
  for (const e of entries) {
    let d = 0; let c = 0;
    for (const l of e.lines) {
      const amt = Number(l.amount);
      if (l.direction === 'DEBIT') d += amt; else if (l.direction === 'CREDIT') c += amt;
    }
    if (d !== c) {
      console.log(`UNBALANCED ${e.number} debit=${d} credit=${c} (id=${e.id})`);
      unbalanced++;
    }
  }
  const orphanCount = await prisma.transaction.count({ where: { journalEntryId: null } });
  console.log(`Entries: ${entries.length}, Unbalanced: ${unbalanced}, Orphan transactions: ${orphanCount}`);
  if (unbalanced === 0 && orphanCount === 0) {
    console.log('Journal integrity OK.');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
