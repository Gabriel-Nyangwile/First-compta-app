import { finalizeBatchToJournal } from "@/lib/journal";

// Comptes OHADA (fixes pour capital)
const ACCOUNT_4612 = "461200";
const ACCOUNT_1011 = "101100";
const ACCOUNT_1012 = "101200";
const ACCOUNT_1013 = "101300";
const ACCOUNT_109  = "109000";

// Helpers
function asNumber(v) {
  if (v?.toNumber) return v.toNumber();
  return Number(v || 0);
}

async function resolveAccountIdByNumber(tx, accountNumber, companyId) {
  const acc = await tx.account.findFirst({
    where: { number: accountNumber, ...(companyId ? { companyId } : {}) },
  });
  if (!acc) throw new Error(`Compte ${accountNumber} introuvable`);
  return acc.id;
}

/**
 * Posting de paiement d'appel de fonds (libération) :
 * Dr 52/57 (accountId choisi) / Cr 4612
 */
export async function postCapitalPayment(tx, { payment, account, companyId }) {
  const amount = asNumber(payment.amount);
  const creditAccId = await resolveAccountIdByNumber(
    tx,
    ACCOUNT_4612,
    companyId
  );
  const debit = await tx.transaction.create({
    data: {
      date: new Date(payment.paymentDate || new Date()),
      description: `Paiement appel capital ${payment.callId}`,
      amount,
      direction: "DEBIT",
      kind: "CAPITAL_PAYMENT",
      accountId: account.id,
      companyId: companyId || null,
    },
  });
  const credit = await tx.transaction.create({
    data: {
      date: new Date(payment.paymentDate || new Date()),
      description: `Apporteurs capital (call ${payment.callId})`,
      amount,
      direction: "CREDIT",
      kind: "CAPITAL_PAYMENT",
      accountId: creditAccId,
      companyId: companyId || null,
    },
  });
  const je = await finalizeBatchToJournal(tx, {
    kind: "CAPITAL_PAYMENT",
    reference: payment.callId,
    date: new Date(payment.paymentDate || new Date()),
    transactions: [debit, credit],
  });
  await tx.capitalPayment.update({
    where: { id: payment.id },
    data: { journalEntryId: je.id },
  });
  return je;
}

/**
 * Posting d'appel de fonds (constatation créance / reclassement non appelé -> appelé) :
 * Dr 4612 / Cr 109
 * Dr 1011 / Cr 1012
 */
export async function postCapitalCall(tx, { call, companyId }) {
  const amt = asNumber(call.amountCalled);
  if (!(amt > 0)) return null;
  const acc4612 = await resolveAccountIdByNumber(tx, ACCOUNT_4612, companyId);
  const acc109 = await resolveAccountIdByNumber(tx, ACCOUNT_109, companyId);
  const acc1011 = await resolveAccountIdByNumber(tx, ACCOUNT_1011, companyId);
  const acc1012 = await resolveAccountIdByNumber(tx, ACCOUNT_1012, companyId);
  const date = call.dueDate ? new Date(call.dueDate) : new Date();
  const txs = [];
  txs.push(
    await tx.transaction.create({
      data: {
        date,
        description: `Appel fonds capital ${call.callNumber}`,
      amount: amt,
      direction: "DEBIT",
      kind: "CAPITAL_CALL",
      accountId: acc4612,
      companyId: companyId || null,
    },
  }),
  await tx.transaction.create({
    data: {
      date,
      description: "Capital souscrit non appelé (reclassement)",
      amount: amt,
      direction: "CREDIT",
      kind: "CAPITAL_CALL",
      accountId: acc109,
      companyId: companyId || null,
    },
  }),
  await tx.transaction.create({
    data: {
      date,
      description: "Capital souscrit non appelé",
      amount: amt,
      direction: "DEBIT",
      kind: "CAPITAL_CALL",
      accountId: acc1011,
      companyId: companyId || null,
    },
  }),
  await tx.transaction.create({
    data: {
      date,
      description: "Capital souscrit appelé non versé",
      amount: amt,
      direction: "CREDIT",
      kind: "CAPITAL_CALL",
      accountId: acc1012,
      companyId: companyId || null,
    },
  })
  );
  const je = await finalizeBatchToJournal(tx, {
    kind: "CAPITAL_CALL",
    reference: call.id,
    date,
    transactions: txs,
  });
  return je;
}

/**
 * Posting de souscription initiale (promesse) :
 * Dr 4612 (part appelée d’emblée)
 * Dr 109 (non appelé)
 * Cr 1012 (contrepartie du 461)
 * Cr 1011 (contrepartie du 109)
 * amountCalled: part appelée immédiatement, amountNotCalled: solde non appelé
 */
export async function postCapitalSubscription(
  tx,
  { subscription, amountCalled, amountNotCalled, companyId }
) {
  const called = asNumber(amountCalled);
  const notCalled = asNumber(amountNotCalled);
  const txs = [];
  const acc4612 = await resolveAccountIdByNumber(tx, ACCOUNT_4612, companyId);
  const acc1012 = await resolveAccountIdByNumber(tx, ACCOUNT_1012, companyId);
  const acc109 = await resolveAccountIdByNumber(tx, ACCOUNT_109, companyId);
  const acc1011 = await resolveAccountIdByNumber(tx, ACCOUNT_1011, companyId);
  const date = new Date();
  if (called > 0) {
    txs.push(
      await tx.transaction.create({
        data: {
          date,
          description: `Souscription appelée ${subscription.id}`,
          amount: called,
          direction: "DEBIT",
          kind: "CAPITAL_SUBSCRIPTION",
          accountId: acc4612,
          companyId: companyId || null,
        },
      }),
      await tx.transaction.create({
        data: {
          date,
          description: `Capital souscrit appelé non versé`,
          amount: called,
          direction: "CREDIT",
          kind: "CAPITAL_SUBSCRIPTION",
          accountId: acc1012,
          companyId: companyId || null,
        },
      })
    );
  }
  if (notCalled > 0) {
    txs.push(
      await tx.transaction.create({
        data: {
          date,
          description: `Capital souscrit non appelé`,
          amount: notCalled,
          direction: "DEBIT",
          kind: "CAPITAL_SUBSCRIPTION",
          accountId: acc109,
          companyId: companyId || null,
        },
      }),
      await tx.transaction.create({
        data: {
          date,
          description: `Capital souscrit non appelé`,
          amount: notCalled,
          direction: "CREDIT",
          kind: "CAPITAL_SUBSCRIPTION",
          accountId: acc1011,
          companyId: companyId || null,
        },
      })
    );
  }
  if (!txs.length) return null;
  const je = await finalizeBatchToJournal(tx, {
    kind: "CAPITAL_SUBSCRIPTION",
    reference: subscription.id,
    date,
    transactions: txs,
  });
  return je;
}

/**
 * Régularisation finale : Dr 1012 / Cr 1013
 */
export async function postCapitalRegularization(
  tx,
  { capitalOperationId, amount, companyId }
) {
  const amt = asNumber(amount);
  if (!(amt > 0)) return null;
  const acc1012 = await resolveAccountIdByNumber(tx, ACCOUNT_1012, companyId);
  const acc1013 = await resolveAccountIdByNumber(tx, ACCOUNT_1013, companyId);
  const date = new Date();
  const txs = [
    await tx.transaction.create({
      data: {
        date,
        description: `Capital souscrit appelé non versé (reclassement)`,
      amount: amt,
      direction: "DEBIT",
      kind: "CAPITAL_REGULARIZATION",
      accountId: acc1012,
      companyId: companyId || null,
    },
  }),
  await tx.transaction.create({
    data: {
      date,
      description: `Capital souscrit appelé versé non amorti`,
      amount: amt,
      direction: "CREDIT",
      kind: "CAPITAL_REGULARIZATION",
      accountId: acc1013,
      companyId: companyId || null,
    },
  }),
];
  const je = await finalizeBatchToJournal(tx, {
    kind: "CAPITAL_REGULARIZATION",
    reference: capitalOperationId,
    date,
    transactions: txs,
  });
  return je;
}
