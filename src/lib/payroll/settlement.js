import prisma from '../prisma.js';
import { nextSequence } from '../sequence.js';
import { finalizeBatchToJournal, computeDebitCredit } from '../journal.js';
import { matchPayrollLiabilityTransactions } from './lettering.js';
import {
  extractPayrollSettlementRef,
  getPayrollSettlementConfig,
  isPayrollSettlementDescription,
  PAYROLL_SETTLEMENT_CONFIGS,
  PAYROLL_SETTLEMENT_PREFIXES,
} from './settlement-config.js';

function parseEmployeeIdFromSettlement(description) {
  const employeeMatch = description?.match(/employ[eé]\s+([a-z0-9-]+)/i);
  return employeeMatch ? employeeMatch[1] : null;
}

function parseLiabilityCodeFromDescription(description) {
  const ref = extractPayrollSettlementRef(description);
  if (!ref) return 'NET_PAY';
  const config = Object.values(PAYROLL_SETTLEMENT_CONFIGS).find((item) => ref.toUpperCase().startsWith(item.prefix));
  return config?.code || 'NET_PAY';
}

function buildSettlementDescription(config, periodRef, settlementRef, employeeId = null) {
  if (config.code === 'NET_PAY') {
    return employeeId
      ? `Règlement ${config.label} ${periodRef} employé ${employeeId} ${settlementRef}`
      : `Règlement ${config.label} ${periodRef} ${settlementRef}`;
  }
  return `Règlement ${config.label} ${periodRef} ${settlementRef}`;
}

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0) ?? 0;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function computeLiabilityBaseTotal(period, liabilityCode, employeeId = null) {
  const targetPayslips = employeeId
    ? period.payslips.filter((payslip) => payslip.employeeId === employeeId)
    : period.payslips;
  if (!targetPayslips.length) {
    throw new Error(employeeId ? 'No payslip found for employee in this period' : 'No payslips to settle');
  }
  if (liabilityCode === 'NET_PAY') {
    return round2(targetPayslips.reduce((sum, payslip) => sum + toNumber(payslip.netAmount), 0));
  }
  let total = 0;
  for (const payslip of targetPayslips) {
    const lines = payslip.lines || [];
    for (const line of lines) {
      const amount = toNumber(line.amount);
      if (liabilityCode === 'CNSS' && (line.code === 'CNSS_EMP' || line.code === 'CNSS_ER')) total += Math.abs(amount);
      else if (liabilityCode === 'ONEM' && line.code === 'ONEM') total += Math.abs(amount);
      else if (liabilityCode === 'INPP' && line.code === 'INPP') total += Math.abs(amount);
      else if (liabilityCode === 'PAYE_TAX' && line.code === 'IPR') total += Math.abs(amount);
    }
  }
  return round2(total);
}

async function resolvePayrollSettlementAccounts(period, config, opts = {}) {
  const { accountNumber, companyId } = opts;
  const scopedCompanyId = companyId || period.companyId || null;
  const mappings = await prisma.payrollAccountMapping.findMany({ where: { active: true, ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}) } });
  const index = Object.fromEntries(mappings.map((mapping) => [mapping.code, mapping]));
  async function resolve(code) {
    const mapping = index[code];
    if (!mapping) throw new Error(`Missing payroll account mapping for code ${code}`);
    if (mapping.accountId) return mapping.accountId;
    if (!mapping.accountNumber) throw new Error(`Mapping ${code} missing accountNumber`);
    let account = await prisma.account.findFirst({ where: { number: mapping.accountNumber, ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}) } });
    if (!account) {
      account = await prisma.account.create({ data: { companyId: scopedCompanyId, number: mapping.accountNumber, label: mapping.label || code } });
    }
    return account.id;
  }

  const liabilityAccountId = await resolve(config.mappingCode);
  let bankAccountId = null;
  if (accountNumber) {
    let bank = await prisma.account.findFirst({ where: { number: accountNumber, ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}) } });
    if (!bank) bank = await prisma.account.create({ data: { companyId: scopedCompanyId, number: accountNumber, label: 'Banque Paie' } });
    bankAccountId = bank.id;
  } else {
    const bankEnv = process.env.PAYROLL_BANK_NUMBER || process.env.NEXT_PUBLIC_PAYROLL_BANK_NUMBER || '521000';
    if (index.BANK) {
      bankAccountId = await resolve('BANK');
    } else {
      let bank = await prisma.account.findFirst({ where: { number: bankEnv, ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}) } });
      if (!bank) bank = await prisma.account.create({ data: { companyId: scopedCompanyId, number: bankEnv, label: 'Banque Paie (fallback)' } });
      bankAccountId = bank.id;
    }
  }
  return { liabilityAccountId, bankAccountId, scopedCompanyId };
}

export async function listPayrollSettlements(periodId, companyId = null, opts = {}) {
  const { liabilityCode = null } = opts;
  const journals = await prisma.journalEntry.findMany({
    where: {
      sourceType: 'PAYROLL',
      sourceId: periodId,
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { date: 'asc' },
  });

  const settlementJournals = journals.filter((journal) => isPayrollSettlementDescription(journal.description));
  const filteredJournals = liabilityCode
    ? settlementJournals.filter((journal) => parseLiabilityCodeFromDescription(journal.description) === liabilityCode)
    : settlementJournals;

  if (!filteredJournals.length) return [];

  const transactions = await prisma.transaction.findMany({
    where: {
      journalEntryId: { in: filteredJournals.map((journal) => journal.id) },
      ...(companyId ? { companyId } : {}),
    },
    include: { account: true },
  });

  const byJournal = new Map();
  for (const transaction of transactions) {
    if (!byJournal.has(transaction.journalEntryId)) byJournal.set(transaction.journalEntryId, []);
    byJournal.get(transaction.journalEntryId).push(transaction);
  }

  return filteredJournals.map((journal) => {
    const list = byJournal.get(journal.id) || [];
    const debit = list
      .filter((transaction) => transaction.direction === 'DEBIT')
      .reduce((sum, transaction) => sum + (transaction.amount?.toNumber?.() ?? Number(transaction.amount ?? 0)), 0);
    const credit = list
      .filter((transaction) => transaction.direction === 'CREDIT')
      .reduce((sum, transaction) => sum + (transaction.amount?.toNumber?.() ?? Number(transaction.amount ?? 0)), 0);
    const debitTx = list.find((transaction) => transaction.direction === 'DEBIT') || null;
    const creditTx = list.find((transaction) => transaction.direction === 'CREDIT') || null;
    const voucherRef = extractPayrollSettlementRef(journal.description);
    const employeeId = parseEmployeeIdFromSettlement(journal.description);
    const parsedLiabilityCode = parseLiabilityCodeFromDescription(journal.description);
    const config = getPayrollSettlementConfig(parsedLiabilityCode);
    return {
      id: journal.id,
      number: journal.number,
      date: journal.date,
      description: journal.description,
      voucherRef,
      debit,
      credit,
      amount: Math.max(debit, credit),
      employeeId,
      liabilityCode: parsedLiabilityCode,
      liabilityLabel: config.label,
      bankAccount: creditTx?.account?.number || null,
      liabilityAccount: debitTx?.account?.number || null,
      letterRef: debitTx?.letterRef || creditTx?.letterRef || null,
      letterStatus: debitTx?.letterStatus || creditTx?.letterStatus || 'UNMATCHED',
    };
  });
}

/**
 * Règle le net à payer (421) d'une période POSTED vers un compte banque/caisse.
 * Options: { accountNumber?, dryRun?, employeeId? } -> si employeeId présent, ne règle que le(s) bulletins de cet employé.
 */
export async function postPayrollSettlement(periodId, opts = {}) {
  const { accountNumber, dryRun, employeeId, companyId, liabilityCode = 'NET_PAY' } = opts;
  const config = getPayrollSettlementConfig(liabilityCode);
  const scopedCompanyId = companyId || null;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId, ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}) },
    include: { payslips: { include: { lines: true } } },
  });
  if (!period) throw new Error('Period not found');
  if (period.status !== 'POSTED') throw new Error(`Period must be POSTED (status=${period.status})`);
  if (!period.payslips.length) throw new Error('No payslips to settle');
  if (employeeId && !config.allowEmployee) {
    throw new Error(`Employee-level settlement not supported for ${liabilityCode}`);
  }

  const scopedPeriodCompanyId = scopedCompanyId || period.companyId || null;
  const targetTotal = computeLiabilityBaseTotal(period, liabilityCode, employeeId);
  if (!(targetTotal > 0)) throw new Error(`${liabilityCode} total <= 0 (${targetTotal})`);

  const existingSettlements = await listPayrollSettlements(period.id, scopedPeriodCompanyId, { liabilityCode });
  const hasGlobalSettlement = existingSettlements.some((settlement) => !settlement.employeeId);
  if (employeeId && hasGlobalSettlement) {
    throw new Error(`${liabilityCode} already settled globally`);
  }
  const alreadySettled = existingSettlements
    .filter((settlement) => {
      if (employeeId) return settlement.employeeId === employeeId;
      return true;
    })
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const remainingToSettle = Math.max(0, round2(targetTotal - alreadySettled));
  if (!(remainingToSettle > 0)) {
    if (employeeId) throw new Error(`Employee already settled for ${liabilityCode} in this period`);
    throw new Error(`${liabilityCode} already fully settled`);
  }

  const { liabilityAccountId, bankAccountId } = await resolvePayrollSettlementAccounts(period, config, {
    accountNumber,
    companyId: scopedPeriodCompanyId,
  });

  if (dryRun) {
    return {
      dryRun: true,
      liabilityCode,
      targetTotal,
      alreadySettled,
      remainingToSettle,
      liabilityAccountId,
      bankAccountId,
      employeeId: employeeId || null,
    };
  }

  const today = new Date();
  const txn = await prisma.$transaction(async (tx) => {
    const settlementRef = await nextSequence(tx, config.sequenceName, config.prefix, scopedPeriodCompanyId);
    const desc = buildSettlementDescription(config, period.ref, settlementRef, employeeId);
    const debitLiability = await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: remainingToSettle,
        direction: 'DEBIT',
        kind: config.debitKind,
        companyId: scopedPeriodCompanyId,
        accountId: liabilityAccountId,
      }
    });
    const creditBank = await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: remainingToSettle,
        direction: 'CREDIT',
        kind: 'PAYMENT',
        companyId: scopedPeriodCompanyId,
        accountId: bankAccountId,
      }
    });
    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'PAYROLL', // journal source type existant
      sourceId: period.id,
      date: today,
      description: desc,
      transactions: [debitLiability, creditBank],
    });
    const lettering = await matchPayrollLiabilityTransactions({
      periodId: period.id,
      liabilityCode,
      companyId: scopedPeriodCompanyId,
      db: tx,
    });
    return { journal, transactions: [debitLiability, creditBank], settlementRef, lettering };
  });
  const { debit, credit } = computeDebitCredit(txn.transactions);
  return {
    settlementRef: txn.settlementRef,
    journalNumber: txn.journal.number,
    debit,
    credit,
    employeeId: employeeId || null,
    liabilityCode,
    settledTotal: remainingToSettle,
    lettering: txn.lettering,
  };
}
