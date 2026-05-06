import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { assertAccountingPeriodOpen } from "@/lib/fiscalYearLock";

export async function createManualJournalEntry({
  companyId,
  actorUserId = null,
  entryDate,
  description,
  supportRef,
  isDraft = false,
  normalized,
  totalDebit,
  totalCredit,
  client = prisma,
}) {
  return client.$transaction(async (tx) => {
    if (!isDraft) {
      await assertAccountingPeriodOpen(tx, {
        companyId,
        date: entryDate,
        context: "OD manuelle",
      });
    }

    const number = await nextSequence(tx, "JRN", "JRN-", companyId);
    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId,
        number,
        date: entryDate,
        sourceType: "MANUAL",
        sourceId: `manual-od:${number}`,
        supportRef: String(supportRef || "").trim() || null,
        draftPayload: isDraft ? { lines: normalized } : null,
        preparedByUserId: actorUserId || null,
        preparedAt: new Date(),
        validatedByUserId: isDraft ? null : actorUserId || null,
        validatedAt: isDraft ? null : new Date(),
        description: String(description || "").trim() || "Opération diverse manuelle",
        status: isDraft ? "DRAFT" : "POSTED",
      },
    });

    const transactions = [];
    if (!isDraft) {
      for (const line of normalized) {
        const amount = line.debit > 0 ? line.debit : line.credit;
        const direction = line.debit > 0 ? "DEBIT" : "CREDIT";
        const transaction = await tx.transaction.create({
          data: {
            companyId,
            date: entryDate,
            nature: "manual",
            description:
              line.description ||
              String(description || "").trim() ||
              `OD manuelle ${number}`,
            amount,
            direction,
            kind: "ADJUSTMENT",
            accountId: line.accountId,
            journalEntryId: journalEntry.id,
          },
        });
        transactions.push(transaction);
      }
    }

    return {
      id: journalEntry.id,
      number: journalEntry.number,
      date: journalEntry.date,
      status: journalEntry.status,
      supportRef: journalEntry.supportRef,
      description: journalEntry.description,
      lineCount: isDraft ? normalized.length : transactions.length,
      totalDebit,
      totalCredit,
    };
  });
}
