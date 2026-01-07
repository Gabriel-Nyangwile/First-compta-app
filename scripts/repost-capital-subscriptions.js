import prisma from "../src/lib/prisma.js";
import { createJournalEntry } from "../src/lib/journal.js";

const ACC_109 = "109000";
const ACC_1011 = "101100";

async function resolveAccountId(tx, number) {
  const acc = await tx.account.findFirst({ where: { number } });
  if (!acc) throw new Error(`Compte ${number} introuvable`);
  return acc.id;
}

/**
 * Reposte toutes les souscriptions de capital :
 * - Supprime les écritures CAPITAL_SUBSCRIPTION existantes liées à la souscription (description contient l'id)
 * - Reposte la promesse : Dr 109 / Cr 1011 sur le nominal
 *
 * Usage : node --env-file=.env.local scripts/repost-capital-subscriptions.js
 */
async function main() {
  const subs = await prisma.capitalSubscription.findMany();
  console.log(`Repost de ${subs.length} souscriptions...`);

  for (const sub of subs) {
    await prisma.$transaction(async (tx) => {
      // Purge transactions/JE existants
      const txns = await tx.transaction.findMany({
        where: { kind: "CAPITAL_SUBSCRIPTION", description: { contains: sub.id } },
      });
      const txnIds = txns.map((t) => t.id);
      const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
      if (txnIds.length) await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      if (jeIds.length) await tx.journalEntry.deleteMany({ where: { id: { in: jeIds } } });

      const amt = Number(sub.nominalAmount || 0);
      if (!(amt > 0)) return;
      const acc109 = await resolveAccountId(tx, ACC_109);
      const acc1011 = await resolveAccountId(tx, ACC_1011);
      const date = new Date();
      const debit = await tx.transaction.create({
        data: {
          date,
          description: `Capital souscrit non appelé ${sub.id}`,
          amount: amt,
          direction: "DEBIT",
          kind: "CAPITAL_SUBSCRIPTION",
          accountId: acc109,
        },
      });
      const credit = await tx.transaction.create({
        data: {
          date,
          description: `Capital souscrit non appelé ${sub.id}`,
          amount: amt,
          direction: "CREDIT",
          kind: "CAPITAL_SUBSCRIPTION",
          accountId: acc1011,
        },
      });
      await createJournalEntry(tx, {
        sourceType: "OTHER",
        sourceId: sub.id,
        date,
        transactionIds: [debit.id, credit.id],
        description: `Repost promesse ${sub.id}`,
      });
    });
    console.log(`OK ${sub.id} (${sub.nominalAmount})`);
  }
}

main()
  .then(() => {
    console.log("Terminé.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Erreur:", err);
    process.exit(1);
  });
