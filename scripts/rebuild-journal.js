#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { nextSequence } from '../src/lib/sequence.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Rebuilding Journal...');
  await prisma.$executeRawUnsafe('UPDATE "Transaction" SET "journalEntryId" = NULL WHERE "journalEntryId" IS NOT NULL');
  await prisma.journalEntry.deleteMany();
  console.log('Cleared existing journal entries.');
  const txs = await prisma.transaction.findMany({ orderBy: { date: 'asc' } });
  console.log(`Loaded ${txs.length} transactions`);
  const groups = new Map();
  for (const t of txs) {
    const key = t.invoiceId || t.incomingInvoiceId || t.moneyMovementId || `MISC:${t.date.toISOString().slice(0,10)}:${t.nature}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  console.log(`Group count: ${groups.size}`);
  let created = 0; let skipped = 0;
  for (const [key, list] of groups.entries()) {
    let debit = 0; let credit = 0;
    for (const l of list) {
      const amt = Number(l.amount);
      if (l.direction === 'DEBIT') debit += amt; else if (l.direction === 'CREDIT') credit += amt;
    }
    if (debit !== credit) {
      console.log(`SKIP unbalanced group ${key} debit=${debit} credit=${credit}`);
      skipped++;
      continue;
    }
    await prisma.$transaction(async(tx) => {
      let sourceType = 'OTHER'; let sourceId = null;
      const sample = list[0];
      if (sample.invoiceId) { sourceType = 'INVOICE'; sourceId = sample.invoiceId; }
      else if (sample.incomingInvoiceId) { sourceType = 'INCOMING_INVOICE'; sourceId = sample.incomingInvoiceId; }
      else if (sample.moneyMovementId) { sourceType = 'MONEY_MOVEMENT'; sourceId = sample.moneyMovementId; }
      const number = await nextSequence(tx, 'JRN', 'JRN-');
      const je = await tx.journalEntry.create({ data: { number, date: sample.date, sourceType, sourceId, status: 'POSTED' } });
      await tx.transaction.updateMany({ where: { id: { in: list.map(l => l.id) } }, data: { journalEntryId: je.id } });
      created++;
    });
  }
  console.log(`Rebuild complete. Created ${created} JournalEntry. Skipped (unbalanced) ${skipped}.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
