import prisma from '../prisma.js';
import { nextSequence } from '../sequence.js';
import { finalizeBatchToJournal, computeDebitCredit } from '../journal.js';

/**
 * Règle le net à payer (421) d'une période POSTED vers un compte banque/caisse.
 * Options: { accountNumber?, dryRun?, employeeId? } -> si employeeId présent, ne règle que le(s) bulletins de cet employé.
 */
export async function postPayrollSettlement(periodId, opts = {}) {
  const { accountNumber, dryRun, employeeId } = opts;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { payslips: true },
  });
  if (!period) throw new Error('Period not found');
  if (period.status !== 'POSTED') throw new Error(`Period must be POSTED (status=${period.status})`);
  if (!period.payslips.length) throw new Error('No payslips to settle');

  const targetPayslips = employeeId ? period.payslips.filter(p => p.employeeId === employeeId) : period.payslips;
  if (!targetPayslips.length) throw new Error(employeeId ? 'No payslip found for employee in this period' : 'No payslips to settle');
  const netTotal = targetPayslips.reduce((s, ps) => s + (ps.netAmount?.toNumber?.() ?? Number(ps.netAmount) ?? 0), 0);
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
    const bankEnv = process.env.PAYROLL_BANK_NUMBER || process.env.NEXT_PUBLIC_PAYROLL_BANK_NUMBER || '521000';
    const bankMapping = index['BANK'];
    if (bankMapping) {
      bankAccountId = await resolve('BANK');
    } else {
      let bank = await prisma.account.findFirst({ where: { number: bankEnv } });
      if (!bank) bank = await prisma.account.create({ data: { number: bankEnv, label: 'Banque Paie (fallback)' } });
      bankAccountId = bank.id;
    }
  }

  if (dryRun) {
    return { dryRun: true, netTotal, netPayAccountId, bankAccountId, employeeId: employeeId || null };
  }

  const today = new Date();
  const settlementRef = await nextSequence(prisma, 'PAYROLL_SETTLEMENT', 'PAYSET-');
  const desc = employeeId
    ? `Règlement net paie ${period.ref} employé ${employeeId} ${settlementRef}`
    : `Règlement net paie ${period.ref} ${settlementRef}`;
  const txn = await prisma.$transaction(async (tx) => {
    const debitBank = await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: netTotal,
        direction: 'DEBIT',
        kind: 'PAYMENT',
        accountId: bankAccountId,
      }
    });
    const creditNet = await tx.transaction.create({
      data: {
        date: today,
        description: desc,
        amount: netTotal,
        direction: 'CREDIT',
        kind: 'WAGES_PAYABLE',
        accountId: netPayAccountId,
      }
    });
    const journal = await finalizeBatchToJournal(tx, {
      sourceType: 'PAYROLL', // journal source type existant
      sourceId: period.id,
      date: today,
      description: desc,
      voucherRef: settlementRef,
      transactions: [debitBank, creditNet],
    });
    return { journal, transactions: [debitBank, creditNet] };
  });
  const { debit, credit } = computeDebitCredit(txn.transactions);
  return { settlementRef, journalNumber: txn.journal.number, debit, credit, employeeId: employeeId || null };
}
