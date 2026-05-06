import prisma from "@/lib/prisma";
import { createJournalEntry } from "./journal.js";

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Date d'annulation invalide.");
  return date;
}

function isManualOd(entry) {
  return (
    entry?.sourceType === "MANUAL" &&
    typeof entry.sourceId === "string" &&
    entry.sourceId.startsWith("manual-od:")
  );
}

function oppositeDirection(direction) {
  return direction === "DEBIT" ? "CREDIT" : "DEBIT";
}

export async function reverseManualJournalEntry({
  companyId,
  journalEntryId,
  reversalDate = new Date(),
  reason = null,
  client = prisma,
}) {
  const date = toDate(reversalDate);

  return client.$transaction(async (tx) => {
    const entry = await tx.journalEntry.findFirst({
      where: { id: journalEntryId, companyId },
      include: { lines: true },
    });
    if (!entry) throw new Error("Écriture introuvable.");
    if (!isManualOd(entry)) {
      throw new Error("Seules les OD manuelles peuvent être annulées depuis cet écran.");
    }
    if (entry.status !== "POSTED") {
      throw new Error("Seule une OD publiée peut être annulée.");
    }
    if (!entry.lines.length) {
      throw new Error("Aucune ligne à contrepasser.");
    }

    const reversalSourceId = `manual-od-reversal:${entry.id}`;
    const existingReversal = await tx.journalEntry.findFirst({
      where: { companyId, sourceType: "MANUAL", sourceId: reversalSourceId },
      select: { id: true, number: true },
    });
    if (existingReversal) {
      throw new Error(`OD déjà annulée par ${existingReversal.number}.`);
    }

    const transactions = [];
    for (const line of entry.lines) {
      transactions.push(
        await tx.transaction.create({
          data: {
            companyId,
            date,
            nature: "manual",
            description: `Annulation ${entry.number} - ${line.description || entry.description || "OD manuelle"}`,
            amount: line.amount,
            direction: oppositeDirection(line.direction),
            kind: line.kind,
            accountId: line.accountId,
            clientId: line.clientId,
            supplierId: line.supplierId,
          },
        })
      );
    }

    const journalEntry = await createJournalEntry(tx, {
      sourceType: "MANUAL",
      sourceId: reversalSourceId,
      supportRef: `ANNUL-${entry.number}`,
      date,
      transactionIds: transactions.map((transaction) => transaction.id),
      description: reason
        ? `Annulation OD manuelle ${entry.number} - ${reason}`
        : `Annulation OD manuelle ${entry.number}`,
    });

    return {
      original: {
        id: entry.id,
        number: entry.number,
      },
      reversal: {
        id: journalEntry.id,
        number: journalEntry.number,
        date: journalEntry.date,
        description: journalEntry.description,
      },
      reversedCount: transactions.length,
    };
  });
}
