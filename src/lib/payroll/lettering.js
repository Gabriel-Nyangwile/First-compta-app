import { Prisma, TransactionLetterStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { nextSequence } from '@/lib/sequence';
import { getPayrollSettlementConfig, PAYROLL_SETTLEMENT_CONFIGS } from '@/lib/payroll/settlement-config';
import { listCurrentPayrollScopeJournals } from '@/lib/payroll/journals';

const ZERO = new Prisma.Decimal('0');
const TOLERANCE = new Prisma.Decimal('0.01');

function toDecimal(value) {
  if (value == null) return ZERO;
  if (value instanceof Prisma.Decimal) return value;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return ZERO;
  }
}

function approxEqual(a, b) {
  return toDecimal(a).minus(toDecimal(b)).abs().lte(TOLERANCE);
}

function approxZero(value) {
  return toDecimal(value).abs().lte(TOLERANCE);
}

async function resolvePayrollLiabilityAccountId(db, liabilityCode, companyId = null) {
  const config = getPayrollSettlementConfig(liabilityCode);
  const mapping = await db.payrollAccountMapping.findFirst({
    where: { code: config.mappingCode, active: true, ...(companyId ? { companyId } : {}) },
  });
  if (!mapping) throw new Error(`Missing payroll account mapping for code ${config.mappingCode}`);
  if (mapping.accountId) return mapping.accountId;
  if (!mapping.accountNumber) throw new Error(`Mapping ${config.mappingCode} missing accountNumber`);
  const account = await db.account.findFirst({ where: { number: mapping.accountNumber, ...(companyId ? { companyId } : {}) } });
  if (!account) throw new Error(`Account ${mapping.accountNumber} for mapping ${config.mappingCode} not found`);
  return account.id;
}

function allocateSide(rows, targetAmount) {
  let remaining = toDecimal(targetAmount);
  return rows.map((row) => {
    const amount = toDecimal(row.amount);
    let letteredAmount = ZERO;
    if (remaining.gt(ZERO)) {
      if (remaining.gte(amount) || approxEqual(remaining, amount)) {
        letteredAmount = amount;
        remaining = remaining.minus(amount);
      } else {
        letteredAmount = remaining;
        remaining = ZERO;
      }
    }

    let letterStatus = TransactionLetterStatus.UNMATCHED;
    if (approxEqual(letteredAmount, amount) || (approxZero(amount) && approxZero(letteredAmount))) {
      letterStatus = TransactionLetterStatus.MATCHED;
    } else if (!approxZero(letteredAmount)) {
      letterStatus = TransactionLetterStatus.PARTIAL;
    }

    return { id: row.id, amount, letteredAmount, letterStatus };
  });
}

async function listPayrollLiabilityTransactions(db, periodId, liabilityCode, companyId = null) {
  const liabilityAccountId = await resolvePayrollLiabilityAccountId(db, liabilityCode, companyId);
  const scopedJournalIds = (await listCurrentPayrollScopeJournals(db, periodId, companyId, { id: true, description: true }))
    .map((journal) => journal.id);
  if (!scopedJournalIds.length) return { liabilityAccountId, transactions: [] };
  const transactions = await db.transaction.findMany({
    where: {
      accountId: liabilityAccountId,
      ...(companyId ? { companyId } : {}),
      journalEntryId: { in: scopedJournalIds },
      NOT: { description: { contains: 'Annulation paie' } },
    },
    include: {
      journalEntry: { select: { id: true, number: true, date: true, description: true } },
      account: { select: { number: true, label: true } },
    },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  return { liabilityAccountId, transactions };
}

function summarizeTransactions(liabilityCode, transactions) {
  const debitTotal = transactions
    .filter((transaction) => transaction.direction === 'DEBIT')
    .reduce((sum, transaction) => sum.plus(toDecimal(transaction.amount)), ZERO);
  const creditTotal = transactions
    .filter((transaction) => transaction.direction === 'CREDIT')
    .reduce((sum, transaction) => sum.plus(toDecimal(transaction.amount)), ZERO);
  const letteredDebit = transactions
    .filter((transaction) => transaction.direction === 'DEBIT')
    .reduce((sum, transaction) => sum.plus(toDecimal(transaction.letteredAmount)), ZERO);
  const letteredCredit = transactions
    .filter((transaction) => transaction.direction === 'CREDIT')
    .reduce((sum, transaction) => sum.plus(toDecimal(transaction.letteredAmount)), ZERO);
  const letterRefs = Array.from(new Set(transactions.map((transaction) => transaction.letterRef).filter(Boolean)));
  const statusSet = Array.from(new Set(transactions.map((transaction) => transaction.letterStatus || 'UNMATCHED')));
  let status = 'UNMATCHED';
  if (statusSet.length === 1 && statusSet[0] === 'MATCHED' && approxEqual(letteredDebit, debitTotal) && approxEqual(letteredCredit, creditTotal)) {
    status = 'MATCHED';
  } else if (!approxZero(letteredDebit) || !approxZero(letteredCredit)) {
    status = 'PARTIAL';
  }

  return {
    liabilityCode,
    transactionCount: transactions.length,
    debitTotal: Number(debitTotal.toString()),
    creditTotal: Number(creditTotal.toString()),
    letteredDebit: Number(letteredDebit.toString()),
    letteredCredit: Number(letteredCredit.toString()),
    status,
    letterRef: letterRefs.length === 1 ? letterRefs[0] : null,
    letterRefs,
  };
}

export async function matchPayrollLiabilityTransactions({ periodId, liabilityCode = 'NET_PAY', companyId = null, db = prisma } = {}) {
  if (!periodId) throw new Error('periodId requis');
  const config = getPayrollSettlementConfig(liabilityCode);
  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId, ...(companyId ? { companyId } : {}) },
    select: { id: true, ref: true, companyId: true },
  });
  if (!period) throw new Error('Payroll period not found');

  const scopedCompanyId = companyId || period.companyId || null;
  const { transactions } = await listPayrollLiabilityTransactions(db, period.id, liabilityCode, scopedCompanyId);
  if (!transactions.length) {
    return {
      liabilityCode,
      liabilityLabel: config.label,
      updated: 0,
      letterRef: null,
      status: 'NO_TRANSACTIONS',
      summary: summarizeTransactions(liabilityCode, transactions),
    };
  }

  const debitRows = transactions.filter((transaction) => transaction.direction === 'DEBIT');
  const creditRows = transactions.filter((transaction) => transaction.direction === 'CREDIT');
  if (!debitRows.length || !creditRows.length) {
    return {
      liabilityCode,
      liabilityLabel: config.label,
      updated: 0,
      letterRef: null,
      status: 'NO_MATCHABLE_PAIR',
      summary: summarizeTransactions(liabilityCode, transactions),
    };
  }

  const existingRefs = Array.from(new Set(transactions.map((transaction) => transaction.letterRef).filter(Boolean)));
  if (existingRefs.length > 1) {
    throw new Error(`Multiple letter refs found for ${liabilityCode} on ${period.ref}`);
  }

  const debitTotal = debitRows.reduce((sum, transaction) => sum.plus(toDecimal(transaction.amount)), ZERO);
  const creditTotal = creditRows.reduce((sum, transaction) => sum.plus(toDecimal(transaction.amount)), ZERO);
  const targetAmount = debitTotal.lte(creditTotal) ? debitTotal : creditTotal;
  if (approxZero(targetAmount)) {
    return {
      liabilityCode,
      liabilityLabel: config.label,
      updated: 0,
      letterRef: existingRefs[0] || null,
      status: 'NO_SETTLEMENT',
      summary: summarizeTransactions(liabilityCode, transactions),
    };
  }

  const debitAllocations = allocateSide(debitRows, targetAmount);
  const creditAllocations = allocateSide(creditRows, targetAmount);
  const letterRef = existingRefs[0] || (await nextSequence(db, 'LTR', 'LTR-', scopedCompanyId));
  const now = new Date();
  const updates = [];

  for (const allocation of [...debitAllocations, ...creditAllocations]) {
    const transaction = transactions.find((item) => item.id === allocation.id);
    const hasLettering = !approxZero(allocation.letteredAmount);
    const nextLetterRef = hasLettering ? letterRef : null;
    const nextLetteredAt = hasLettering ? transaction.letteredAt || now : null;
    const nextStatus = hasLettering ? allocation.letterStatus : TransactionLetterStatus.UNMATCHED;
    if (
      transaction.letterRef !== nextLetterRef ||
      transaction.letterStatus !== nextStatus ||
      !approxEqual(transaction.letteredAmount, allocation.letteredAmount) ||
      (hasLettering && !transaction.letteredAt) ||
      (!hasLettering && transaction.letteredAt)
    ) {
      updates.push({
        id: transaction.id,
        data: {
          letterRef: nextLetterRef,
          letterStatus: nextStatus,
          letteredAmount: allocation.letteredAmount,
          letteredAt: nextLetteredAt,
        },
      });
    }
  }

  for (const update of updates) {
    await db.transaction.update({ where: { id: update.id }, data: update.data });
  }

  const refreshed = await listPayrollLiabilityTransactions(db, period.id, liabilityCode, scopedCompanyId);
  const summary = summarizeTransactions(liabilityCode, refreshed.transactions);
  return {
    liabilityCode,
    liabilityLabel: config.label,
    updated: updates.length,
    letterRef,
    status: summary.status,
    summary,
  };
}

export async function getPayrollLetteringSummary({ periodId, companyId = null, db = prisma } = {}) {
  if (!periodId) throw new Error('periodId requis');
  const period = await db.payrollPeriod.findUnique({
    where: { id: periodId, ...(companyId ? { companyId } : {}) },
    select: { id: true, ref: true, companyId: true },
  });
  if (!period) throw new Error('Payroll period not found');
  const scopedCompanyId = companyId || period.companyId || null;
  const items = [];
  for (const liabilityCode of Object.keys(PAYROLL_SETTLEMENT_CONFIGS)) {
    const { transactions } = await listPayrollLiabilityTransactions(db, period.id, liabilityCode, scopedCompanyId);
    items.push({
      liabilityCode,
      liabilityLabel: getPayrollSettlementConfig(liabilityCode).label,
      ...summarizeTransactions(liabilityCode, transactions),
    });
  }
  return {
    period: { id: period.id, ref: period.ref },
    items,
  };
}