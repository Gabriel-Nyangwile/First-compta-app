#!/usr/bin/env node
/**
 * Backfill script Phase 1: create JournalEntry headers and attach existing Transaction rows.
 * Grouping heuristic:
 *  - invoiceId
 *  - incomingInvoiceId
 *  - moneyMovementId
 *  - authorizationId (treasury) / bankAdviceId via joining MoneyMovement -> Authorization/BankAdvice (optional)
 *  - fallback: group by date (day) and kind PAYMENT into synthetic OTHER entry
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting journal backfill...');
  const txs = await prisma.transaction.findMany({
    orderBy: { date: 'asc' },
  });
  console.log(`Loaded ${txs.length} transactions`);
  const groups = new Map();
  for (const t of txs) {
    let key = t.invoiceId || t.incomingInvoiceId || t.moneyMovementId;
    if (!key) {
      // fallback coarse grouping per day + nature
      const d = t.date.toISOString().slice(0,10);
      key = `MISC:${d}:${t.nature}`;
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  console.log(`Group count: ${groups.size}`);
  let created = 0;
  for (const [key, lines] of groups.entries()) {
    // Determine sourceType/sourceId heuristically
    let sourceType = 'OTHER';
    let sourceId = null;
    const sample = lines[0];
    if (sample.invoiceId) { sourceType = 'INVOICE'; sourceId = sample.invoiceId; }
    else if (sample.incomingInvoiceId) { sourceType = 'INCOMING_INVOICE'; sourceId = sample.incomingInvoiceId; }
    else if (sample.moneyMovementId) { sourceType = 'MONEY_MOVEMENT'; sourceId = sample.moneyMovementId; }
    const number = `JRN-${(created+1).toString().padStart(6,'0')}`;
    const je = await prisma.journalEntry.create({
      data: {
        number,
        sourceType,
        sourceId,
        date: sample.date,
        status: 'POSTED',
      }
    });
    await prisma.$transaction(lines.map(l => prisma.transaction.update({
      where: { id: l.id },
      data: { journalEntryId: je.id }
    })));
    created++;
    if (created % 50 === 0) console.log(`Created ${created} journal entries...`);
  }
  console.log(`Backfill complete. Created ${created} JournalEntry records.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
