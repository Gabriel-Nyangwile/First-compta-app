import prisma from "../src/lib/prisma.js";
import { deleteUnreferencedEmptyJournalsByIds } from "../src/lib/journalCleanup.js";

const TX_KINDS = [
  "CAPITAL_SUBSCRIPTION",
  "CAPITAL_CALL",
  "CAPITAL_PAYMENT",
  "CAPITAL_REGULARIZATION",
];

/**
 * Purge complète du module capital :
 * - Transactions & écritures (kinds CAPITAL_*)
 * - Journal entries associées
 * - Paiements d'appel, appels, souscriptions, opérations de capital
 *
 * Usage :
 *   node --env-file=.env.local scripts/purge-capital.js --force
 */
async function main() {
  const companyIdArgIndex = process.argv.indexOf("--companyId");
  const companyId = companyIdArgIndex >= 0 ? process.argv[companyIdArgIndex + 1] : (process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null);
  const dryRun = !process.argv.includes("--apply");
  if (!companyId) {
    console.error("companyId requis (--companyId ou DEFAULT_COMPANY_ID).");
    process.exit(1);
  }
  if (!dryRun && !process.argv.includes("--force")) {
    console.error("Sécurité : ajoute --apply --force pour exécuter la purge.");
    process.exit(1);
  }

  console.log(`Purge capital : démarrage... dryRun=${dryRun} companyId=${companyId}`);

  // 1) Transactions CAPITAL_*
  const txns = await prisma.transaction.findMany({
    where: { kind: { in: TX_KINDS }, companyId },
    select: { id: true, journalEntryId: true },
  });
  const txnIds = txns.map((t) => t.id);
  const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
  if (dryRun) {
    console.log(`Would delete transactions=${txnIds.length}, journals=${jeIds.length}`);
  } else if (txnIds.length) {
    await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
    if (jeIds.length) {
      await deleteUnreferencedEmptyJournalsByIds(prisma, jeIds, companyId);
    }
  }
  console.log(`Transactions supprimées : ${txnIds.length}, Journaux supprimés : ${jeIds.length}`);

  // 2) Paiements d'appels
  const payments = dryRun ? { count: await prisma.capitalPayment.count({ where: { companyId } }) } : await prisma.capitalPayment.deleteMany({ where: { companyId } });
  console.log(`Paiements supprimés : ${payments.count}`);

  // 3) Appels de fonds
  const calls = dryRun ? { count: await prisma.capitalCall.count({ where: { companyId } }) } : await prisma.capitalCall.deleteMany({ where: { companyId } });
  console.log(`Appels supprimés : ${calls.count}`);

  // 4) Souscriptions
  const subs = dryRun ? { count: await prisma.capitalSubscription.count({ where: { companyId } }) } : await prisma.capitalSubscription.deleteMany({ where: { companyId } });
  console.log(`Souscriptions supprimées : ${subs.count}`);

  // 5) Opérations de capital
  const ops = dryRun ? { count: await prisma.capitalOperation.count({ where: { companyId } }) } : await prisma.capitalOperation.deleteMany({ where: { companyId } });
  console.log(`Opérations supprimées : ${ops.count}`);

  console.log("Purge capital terminée.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur purge capital:", err);
    process.exit(1);
  });
