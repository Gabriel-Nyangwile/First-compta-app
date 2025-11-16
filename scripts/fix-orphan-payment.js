#!/usr/bin/env node
/**
 * Rattache manuellement les transactions orphelines issues du paiement du 05/10/2025.
 */

import prisma from "../src/lib/prisma.js";
import { nextSequence } from "../src/lib/sequence.js";

async function main() {
  const invoiceId = "90828a21-735c-4115-8604-beceb1fe97fd";
  const orphanTransactions = await prisma.transaction.findMany({
    where: { invoiceId, journalEntryId: null },
    orderBy: { date: "asc" },
  });

  if (!orphanTransactions.length) {
    console.log("Aucune transaction orpheline pour cette facture.");
    return;
  }

  const sample = orphanTransactions[0];
  const number = await nextSequence(prisma, "JRN", "JRN-");

  const journalEntry = await prisma.journalEntry.create({
    data: {
      number,
      sourceType: "INVOICE",
      sourceId: invoiceId,
      date: sample.date,
      description: "Encaissement retardé — régularisation",
      status: "POSTED",
    },
  });

  await prisma.$transaction(
    orphanTransactions.map((t) =>
      prisma.transaction.update({
        where: { id: t.id },
        data: { journalEntryId: journalEntry.id },
      })
    )
  );

  console.log(
    `JournalEntry ${journalEntry.number} créé pour ${orphanTransactions.length} transaction(s).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
