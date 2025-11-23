import prisma from '../prisma.js';
import { nextSequence } from '../sequence.js';
import { finalizeBatchToJournal, computeDebitCredit } from '../journal.js';

/**
 * Règle le net à payer (421) d'une période POSTED vers un compte banque/caisse.
 * Options: { accountNumber?, dryRun? }
 */
export async function postPayrollSettlement(periodId, opts = {}) {
  const { accountNumber, dryRun } = opts;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { payslips: true },
  });
  if (!period) throw new Error('Period not found');
  if (period.status !== 'POSTED') throw new Error(`Period must be POSTED (status=${period.status})`);
  if (!period.payslips.length) throw new Error('No payslips to settle');

  const netTotal = period.payslips.reduce((s, ps) => s + (ps.netAmount?.toNumber?.() ?? Number(ps.netAmount) ?? 0), 0);
  if (!(netTotal > 0)) throw new Error(`Net total <= 0 (${netTotal})`);

  // Resolve accounts
  const mappings = await prisma.payrollAccountMapping.findMany({ where: { active: true } });
  const index = Object.fromEntries(mappings.map(m => [m.code, m]));
  async function resolve(code) {
    const m = index[code];
    if (!m) throw new Error(`Missing payroll account mapping for code ${code}`);
    if (m.accountId) return m.accountId;
    if (!m.accountNumber) throw new Error(`Mapping ${code} missing accountNumber`);
    let acc = await prisma.account.findFirst({ where: { number: m.accountNumber } });
    if (!acc) {
      acc = await prisma.account.create({ data: { number: m.accountNumber, label: m.label || code } });
    }
    return acc.id;
  }
  const netPayAccountId = await resolve('NET_PAY');
  let bankAccountId = null;
  if (accountNumber) {
    let bank = await prisma.account.findFirst({ where: { number: accountNumber } });
    if (!bank) bank = await prisma.account.create({ data: { number: accountNumber, label: 'Banque Paie' } });
    bankAccountId = bank.id;
  } else {
    bankAccountId = await resolve('BANK');
  }

  if (dryRun) {
    return { dryRun: true, netTotal, netPayAccountId, bankAccountId };
  }

  const today = new Date();
  const settlementRef = await nextSequence(prisma, 'PAYROLL_SETTLEMENT', 'PAYSET-');
  const txn = await prisma.$transaction(async (tx) => {
    const debitBank = await tx.transaction.create({
      data: {
        date: today,
        description: `Règlement net paie ${period.ref} ${settlementRef}`,
        amount: netTotal,
        direction: 'DEBIT',
        kind: 'PAYROLL_SETTLEMENT',
        accountId: bankAccountId,
      }
    });
    const creditNet = await tx.transaction.create({
      data: {
        date: today,
        description: `Règlement net paie ${period.ref} ${settlementRef}`,
        amount: netTotal,
        direction: 'CREDIT',
        kind: 'PAYROLL_SETTLEMENT',
        accountId: netPayAccountId,
      }
    });
    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'PAYROLL_SETTLEMENT',
      sourceId: period.id,
      date: today,
      description: `Règlement paie ${period.ref} ${settlementRef}`,
      voucherRef: settlementRef,
      transactions: [debitBank, creditNet],
    });
    return { journal, transactions: [debitBank, creditNet] };
  });
  const { debit, credit } = computeDebitCredit(txn.transactions);
  return { settlementRef, journalNumber: txn.journal.number, debit, credit };
}
