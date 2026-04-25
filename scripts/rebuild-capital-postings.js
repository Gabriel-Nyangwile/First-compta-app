import prisma from "../src/lib/prisma.js";
import {
  buildCapitalSourcePrefix,
  postCapitalCall,
  postCapitalPayment,
  postCapitalRegularization,
  postCapitalSubscription,
} from "../src/lib/capitalPosting.js";
import { deleteUnreferencedEmptyJournalsByIds } from "../src/lib/journalCleanup.js";

const TX_KINDS = [
  "CAPITAL_SUBSCRIPTION",
  "CAPITAL_CALL",
  "CAPITAL_PAYMENT",
  "CAPITAL_REGULARIZATION",
];

function asNumber(value) {
  if (value?.toNumber) return value.toNumber();
  return Number(value || 0);
}

function parseArgs() {
  const companyIdArgIndex = process.argv.indexOf("--companyId");
  const companyId =
    companyIdArgIndex >= 0
      ? process.argv[companyIdArgIndex + 1]
      : process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const apply = process.argv.includes("--apply");
  return { companyId, dryRun: !apply };
}

async function collectCapitalJournalIds(tx, companyId) {
  const txns = await tx.transaction.findMany({
    where: { companyId, kind: { in: TX_KINDS } },
    select: { journalEntryId: true },
  });

  const journals = await tx.journalEntry.findMany({
    where: {
      companyId,
      OR: [
        { sourceId: { startsWith: "capital:" } },
        { capitalPayments: { some: {} } },
      ],
    },
    select: { id: true },
  });

  return [
    ...new Set([
      ...txns.map((row) => row.journalEntryId).filter(Boolean),
      ...journals.map((row) => row.id),
    ]),
  ];
}

async function main() {
  const { companyId, dryRun } = parseArgs();
  if (!companyId) {
    throw new Error("companyId requis (--companyId ou DEFAULT_COMPANY_ID).");
  }

  const [operations, subscriptions, calls, payments, capitalJournalIds, capitalTxnCount] =
    await Promise.all([
      prisma.capitalOperation.findMany({
        where: { companyId },
        orderBy: [{ resolutionDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.capitalSubscription.findMany({
        where: { companyId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.capitalCall.findMany({
        where: { companyId },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.capitalPayment.findMany({
        where: { companyId },
        include: { account: true, call: true },
        orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      }),
      collectCapitalJournalIds(prisma, companyId),
      prisma.transaction.count({ where: { companyId, kind: { in: TX_KINDS } } }),
    ]);

  const summary = {
    companyId,
    dryRun,
    operations: operations.length,
    subscriptions: subscriptions.length,
    calls: calls.length,
    payments: payments.length,
    transactionsToDelete: capitalTxnCount,
    journalsToDelete: capitalJournalIds.length,
  };

  console.log("Rebuild capital postings:", JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log("Dry-run terminé. Relancer avec --apply pour exécuter.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (payments.length) {
      await tx.capitalPayment.updateMany({
        where: { companyId, journalEntryId: { not: null } },
        data: { journalEntryId: null },
      });
    }

    await tx.transaction.deleteMany({
      where: { companyId, kind: { in: TX_KINDS } },
    });

    if (capitalJournalIds.length) {
      await deleteUnreferencedEmptyJournalsByIds(tx, capitalJournalIds, companyId);
    }

    for (const subscription of subscriptions) {
      const nominal = asNumber(subscription.nominalAmount);
      if (!(nominal > 0)) continue;
      await postCapitalSubscription(tx, {
        subscription,
        amountCalled: 0,
        amountNotCalled: nominal,
        companyId,
        dateOverride: subscription.createdAt,
      });
    }

    for (const call of calls) {
      await postCapitalCall(tx, { call, companyId });
    }

    for (const payment of payments) {
      if (!payment.account) {
        throw new Error(`Paiement de capital ${payment.id} sans compte de trésorerie.`);
      }
      await postCapitalPayment(tx, {
        payment,
        account: payment.account,
        companyId,
      });
    }

    for (const operation of operations) {
      if (operation.status !== "REGISTERED") continue;

      const operationCalls = calls.filter((call) => call.capitalOperationId === operation.id);
      if (!operationCalls.length) continue;
      const callIds = operationCalls.map((call) => call.id);
      const totalCalled = operationCalls.reduce(
        (sum, call) => sum + asNumber(call.amountCalled),
        0
      );
      const totalPaid = payments
        .filter((payment) => callIds.includes(payment.callId))
        .reduce((sum, payment) => sum + asNumber(payment.amount), 0);
      const amount = Math.min(totalCalled, totalPaid);
      if (!(amount > 0)) continue;

      await postCapitalRegularization(tx, {
        capitalOperationId: operation.id,
        amount,
        companyId,
        dateOverride: operation.resolutionDate || operation.updatedAt || new Date(),
      });
    }
  });

  console.log("Reconstruction des écritures de capital terminée.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Erreur reconstruction capital:", error);
    process.exit(1);
  });
