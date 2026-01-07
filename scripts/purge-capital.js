import prisma from "../src/lib/prisma.js";

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
  if (!process.argv.includes("--force")) {
    console.error("Sécurité : ajoute --force pour exécuter la purge.");
    process.exit(1);
  }

  console.log("Purge capital : démarrage...");

  // 1) Transactions CAPITAL_*
  const txns = await prisma.transaction.findMany({
    where: { kind: { in: TX_KINDS } },
    select: { id: true, journalEntryId: true },
  });
  const txnIds = txns.map((t) => t.id);
  const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
  if (txnIds.length) {
    await prisma.transaction.deleteMany({ where: { id: { in: txnIds } } });
  }
  if (jeIds.length) {
    await prisma.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
  }
  console.log(`Transactions supprimées : ${txnIds.length}, Journaux supprimés : ${jeIds.length}`);

  // 2) Paiements d'appels
  const payments = await prisma.capitalPayment.deleteMany({});
  console.log(`Paiements supprimés : ${payments.count}`);

  // 3) Appels de fonds
  const calls = await prisma.capitalCall.deleteMany({});
  console.log(`Appels supprimés : ${calls.count}`);

  // 4) Souscriptions
  const subs = await prisma.capitalSubscription.deleteMany({});
  console.log(`Souscriptions supprimées : ${subs.count}`);

  // 5) Opérations de capital
  const ops = await prisma.capitalOperation.deleteMany({});
  console.log(`Opérations supprimées : ${ops.count}`);

  console.log("Purge capital terminée.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur purge capital:", err);
    process.exit(1);
  });
