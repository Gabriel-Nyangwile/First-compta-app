import { Prisma, TransactionLetterStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";

const ZERO = new Prisma.Decimal(0);
const TOLERANCE = new Prisma.Decimal("0.01");

function maxDecimal(a, b) {
  return toDecimal(a).gte(toDecimal(b)) ? toDecimal(a) : toDecimal(b);
}

function minDecimal(a, b) {
  return toDecimal(a).lte(toDecimal(b)) ? toDecimal(a) : toDecimal(b);
}

function toDecimal(value) {
  if (value === null || value === undefined) return ZERO;
  if (value instanceof Prisma.Decimal) return value;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return ZERO;
  }
}

function approxZero(value) {
  return toDecimal(value).abs().lte(TOLERANCE);
}

function computeStatus(letteredAmount, amount) {
  const lettered = toDecimal(letteredAmount);
  const total = toDecimal(amount);
  if (approxZero(lettered)) return TransactionLetterStatus.UNMATCHED;
  if (lettered.plus(TOLERANCE).gte(total)) {
    return TransactionLetterStatus.MATCHED;
  }
  return TransactionLetterStatus.PARTIAL;
}

function remainingCapacity(tx) {
  return maxDecimal(
    ZERO,
    toDecimal(tx.amount).minus(toDecimal(tx.letteredAmount))
  );
}

function allocateAcrossAmounts(transactions, targetLetteredAmount) {
  let remaining = toDecimal(targetLetteredAmount);
  return transactions.map((tx) => {
    const amount = toDecimal(tx.amount);
    const allocation = minDecimal(amount, remaining);
    remaining = maxDecimal(ZERO, remaining.minus(allocation));
    return { id: tx.id, allocation };
  });
}

export async function matchPartyInvoice({
  party,
  invoiceId,
  expectedPartyId = null,
  companyId = null,
}) {
  if (!["client", "supplier"].includes(party)) {
    throw new Error("party invalide");
  }
  if (!invoiceId) {
    throw new Error("invoiceId requis");
  }

  const isSupplier = party === "supplier";
  const invoiceEntity = isSupplier
    ? await prisma.incomingInvoice.findFirst({
        where: { id: invoiceId, ...(companyId ? { companyId } : {}) },
        select: { id: true, supplierId: true, entryNumber: true },
      })
    : await prisma.invoice.findFirst({
        where: { id: invoiceId, ...(companyId ? { companyId } : {}) },
        select: { id: true, clientId: true, invoiceNumber: true },
      });

  if (!invoiceEntity) {
    throw new Error("Facture introuvable");
  }

  const partyId = isSupplier ? invoiceEntity.supplierId : invoiceEntity.clientId;
  if (!partyId) {
    throw new Error("Tiers lié à la facture introuvable");
  }
  if (expectedPartyId && partyId !== expectedPartyId) {
    throw new Error("La facture ne correspond pas au tiers demandé");
  }

  const invoiceTransactions = await prisma.transaction.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(isSupplier ? { incomingInvoiceId: invoiceId } : { invoiceId }),
      kind: isSupplier ? "PAYABLE" : "RECEIVABLE",
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: {
      id: true,
      amount: true,
      letterRef: true,
      letterStatus: true,
      letteredAmount: true,
      letteredAt: true,
    },
  });

  if (!invoiceTransactions.length) {
    throw new Error("Aucune écriture de dette/créance à lettrer sur cette facture");
  }

  const invoiceTotal = invoiceTransactions.reduce(
    (sum, tx) => sum.plus(toDecimal(tx.amount)),
    ZERO
  );
  const invoiceAlreadyLettered = invoiceTransactions.reduce(
    (sum, tx) => sum.plus(toDecimal(tx.letteredAmount)),
    ZERO
  );
  const invoiceRemaining = maxDecimal(
    ZERO,
    invoiceTotal.minus(invoiceAlreadyLettered)
  );

  if (approxZero(invoiceRemaining)) {
    return {
      updated: 0,
      letterRef: invoiceTransactions.find((tx) => tx.letterRef)?.letterRef || null,
      status: "ALREADY_MATCHED",
      invoiceStatus: TransactionLetterStatus.MATCHED,
    };
  }

  const existingRef =
    invoiceTransactions.find((tx) => tx.letterRef)?.letterRef || null;

  const paymentTransactions = await prisma.transaction.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      kind: "PAYMENT",
      ...(isSupplier
        ? {
            OR: [{ supplierId: partyId }, { moneyMovement: { supplierId: partyId } }],
            moneyMovement: { kind: "SUPPLIER_PAYMENT" },
          }
        : {
            OR: [{ clientId: partyId }, { invoice: { clientId: partyId } }],
            moneyMovement: { kind: "CLIENT_RECEIPT" },
          }),
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: {
      id: true,
      amount: true,
      letterRef: true,
      letterStatus: true,
      letteredAmount: true,
      letteredAt: true,
      moneyMovementId: true,
    },
  });

  const availablePayments = paymentTransactions.filter((tx) => {
    if (remainingCapacity(tx).lte(TOLERANCE)) return false;
    if (!tx.letterRef) return true;
    return existingRef && tx.letterRef === existingRef;
  });

  if (!availablePayments.length) {
    return {
      updated: 0,
      letterRef: existingRef,
      status: "NO_AVAILABLE_PAYMENTS",
      invoiceStatus: computeStatus(invoiceAlreadyLettered, invoiceTotal),
    };
  }

  let needed = invoiceRemaining;
  const paymentAllocations = [];
  for (const tx of availablePayments) {
    if (approxZero(needed)) break;
    const capacity = remainingCapacity(tx);
    if (capacity.lte(TOLERANCE)) continue;
    const allocation = minDecimal(capacity, needed);
    if (allocation.lte(TOLERANCE)) continue;
    paymentAllocations.push({ id: tx.id, allocation });
    needed = maxDecimal(ZERO, needed.minus(allocation));
  }

  const allocatedTotal = paymentAllocations.reduce(
    (sum, item) => sum.plus(item.allocation),
    ZERO
  );

  if (approxZero(allocatedTotal)) {
    return {
      updated: 0,
      letterRef: existingRef,
      status: "NO_AVAILABLE_PAYMENTS",
      invoiceStatus: computeStatus(invoiceAlreadyLettered, invoiceTotal),
    };
  }

  const letterRef =
    existingRef || (await nextSequence(prisma, "LTR", "LTR-", companyId));
  const now = new Date();
  const targetInvoiceLettered = minDecimal(
    invoiceTotal,
    invoiceAlreadyLettered.plus(allocatedTotal)
  );
  const invoiceDistributions = allocateAcrossAmounts(
    invoiceTransactions,
    targetInvoiceLettered
  );

  await prisma.$transaction(async (tx) => {
    for (const distribution of invoiceDistributions) {
      const invoiceTx = invoiceTransactions.find((item) => item.id === distribution.id);
      const nextLetteredAmount = distribution.allocation;
      const nextStatus = computeStatus(nextLetteredAmount, invoiceTx.amount);
      await tx.transaction.update({
        where: { id: distribution.id },
        data: {
          letterRef,
          letterStatus: nextStatus,
          letteredAmount: nextLetteredAmount,
          letteredAt: invoiceTx.letteredAt || now,
        },
      });
    }

    for (const paymentAllocation of paymentAllocations) {
      const paymentTx = availablePayments.find((item) => item.id === paymentAllocation.id);
      const nextLetteredAmount = toDecimal(paymentTx.letteredAmount).plus(
        paymentAllocation.allocation
      );
      const nextStatus = computeStatus(nextLetteredAmount, paymentTx.amount);
      await tx.transaction.update({
        where: { id: paymentAllocation.id },
        data: {
          letterRef,
          letterStatus: nextStatus,
          letteredAmount: nextLetteredAmount,
          letteredAt: paymentTx.letteredAt || now,
        },
      });
    }
  });

  return {
    updated: invoiceDistributions.length + paymentAllocations.length,
    letterRef,
    status: approxZero(needed) ? "MATCHED" : "PARTIAL",
    invoiceStatus: approxZero(needed)
      ? TransactionLetterStatus.MATCHED
      : TransactionLetterStatus.PARTIAL,
    allocatedAmount: allocatedTotal.toString(),
    paymentCount: paymentAllocations.length,
    remainingOnInvoice: maxDecimal(ZERO, needed).toString(),
  };
}
