// Journal utilities: create a JournalEntry grouping a coherent batch of Transaction rows.
// Phase 1 strategy: one JournalEntry per functional event (invoice creation, supplier invoice, payment, etc.).
// If a future need arises to consolidate, we can add a grouping key.
import { nextSequence } from './sequence.js';
import prisma from './prisma.js';

/**
 * Compute debit/credit totals from a list of transactions (already fetched) or raw objects
 */
export function computeDebitCredit(transactions) {
  let debit = 0; let credit = 0;
  for (const t of transactions) {
    const amt = Number(t.amount?.toNumber?.() ?? t.amount);
    if (t.direction === 'DEBIT') debit += amt; else if (t.direction === 'CREDIT') credit += amt;
  }
  return { debit, credit };
}

/**
 * Create a journal entry and attach the given transaction IDs.
 * Throws if resulting entry is not balanced (unless allowUnbalanced=true).
 * @param {Prisma.TransactionClient} tx - Prisma transaction client
 */
export async function createJournalEntry(tx, {
  sourceType = 'OTHER',
  sourceId = null,
  date = new Date(),
  transactionIds = [],
  description = null,
  allowUnbalanced = false,
}) {
  if (!transactionIds.length) throw new Error('createJournalEntry: no transactionIds provided');
  // Fetch transactions to compute totals
  const transactions = await tx.transaction.findMany({
    where: { id: { in: transactionIds } },
    select: { id: true, amount: true, direction: true, companyId: true },
  });
  const companyId = transactions.find((t) => t.companyId)?.companyId || null;
  const { debit, credit } = computeDebitCredit(transactions);
  const balanced = Math.abs(debit - credit) < 0.01;
  if (!balanced && !allowUnbalanced) {
    throw new Error(`Journal entry unbalanced (debit=${debit} credit=${credit})`);
  }
  const number = await nextSequence(tx, 'JRN', 'JRN-', companyId);
  const je = await tx.journalEntry.create({
    data: {
      companyId,
      number,
      date,
      sourceType,
      sourceId,
      description,
      status: 'POSTED'
    }
  });
  // Attach transactions
  await tx.transaction.updateMany({ where: { id: { in: transactionIds } }, data: { journalEntryId: je.id } });
  return je;
}

/**
 * Helper to ensure a journal entry exists for a functional batch inside an existing prisma.$transaction block.
 * Accepts the list of created prisma transaction objects (or their ids) and passes them to createJournalEntry.
 */
export async function finalizeBatchToJournal(tx, options) {
  const ids = options.transactions.map(t => t.id || t);
  return createJournalEntry(tx, { ...options, transactionIds: ids });
}

/**
 * Backfill helper (not used directly in routes here) to retro-create journal entries for orphan transactions.
 */
export async function backfillMissingJournalEntries() {
  const orphan = await prisma.transaction.findMany({ where: { journalEntryId: null }, orderBy: { date: 'asc' } });
  const byKey = new Map();
  for (const t of orphan) {
    const key = t.invoiceId || t.incomingInvoiceId || t.moneyMovementId || `MISC:${t.date.toISOString().slice(0,10)}:${t.nature}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(t);
  }
  let created = 0;
  for (const [key, list] of byKey.entries()) {
    await prisma.$transaction(async(tx) => {
      let sourceType = 'OTHER'; let sourceId = null;
      const s = list[0];
      if (s.invoiceId) { sourceType = 'INVOICE'; sourceId = s.invoiceId; }
      else if (s.incomingInvoiceId) { sourceType = 'INCOMING_INVOICE'; sourceId = s.incomingInvoiceId; }
      else if (s.moneyMovementId) { sourceType = 'MONEY_MOVEMENT'; sourceId = s.moneyMovementId; }
      await createJournalEntry(tx, { sourceType, sourceId, date: s.date, transactionIds: list.map(l => l.id) });
      created++;
    });
  }
  return created;
}
