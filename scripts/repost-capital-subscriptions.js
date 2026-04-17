import prisma from "../src/lib/prisma.js";
import { createJournalEntry } from "../src/lib/journal.js";
import { deleteUnreferencedEmptyJournalsByIds } from "../src/lib/journalCleanup.js";

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
  const companyIdArgIndex = process.argv.indexOf("--companyId");
  const companyId = companyIdArgIndex >= 0 ? process.argv[companyIdArgIndex + 1] : (process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null);
  const dryRun = !process.argv.includes("--apply");
  if (!companyId) throw new Error('companyId requis (--companyId ou DEFAULT_COMPANY_ID)');
  const subs = await prisma.capitalSubscription.findMany({ where: { companyId } });
  console.log(`Repost de ${subs.length} souscriptions... dryRun=${dryRun} companyId=${companyId}`);

  for (const sub of subs) {
    await prisma.$transaction(async (tx) => {
      // Purge transactions/JE existants
      const txns = await tx.transaction.findMany({
        where: { kind: "CAPITAL_SUBSCRIPTION", description: { contains: sub.id }, companyId },
      });
      const txnIds = txns.map((t) => t.id);
      const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
      if (!dryRun && txnIds.length) await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      if (!dryRun && jeIds.length) await deleteUnreferencedEmptyJournalsByIds(tx, jeIds, companyId);

      const amt = Number(sub.nominalAmount || 0);
      if (!(amt > 0)) return;
      const acc109 = await resolveAccountId(tx, ACC_109);
      const acc1011 = await resolveAccountId(tx, ACC_1011);
      if (dryRun) return;
      const date = new Date();
      const debit = await tx.transaction.create({
        data: {
          companyId,
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
          companyId,
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
