#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';
import { generatePayslipsForPeriod } from '../src/lib/payroll/engine.js';
import { postPayrollPeriod } from '../src/lib/payroll/postings.js';

function periodForToday() {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

async function ensurePeriod(year, month) {
  let p = await prisma.payrollPeriod.findFirst({ where: { year, month } });
  if (p) return p;
  const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-');
  p = await prisma.payrollPeriod.create({ data: { year, month, ref, status: 'OPEN' } });
  return p;
}

async function main() {
  const expat = await prisma.employee.findFirst({ where: { status: 'ACTIVE', isExpat: true } });
  if (!expat) {
    console.log('[SKIP] No ACTIVE expatriate employee found. Mark someone with scripts/mark-expatriates.js');
    process.exit(0);
  }
  const nat = await prisma.employee.findFirst({ where: { status: 'ACTIVE', isExpat: false } });
  if (!nat) {
    console.log('[WARN] No ACTIVE national employee found; test will only verify EXP presence.');
  }

  const { year, month } = periodForToday();
  const period = await ensurePeriod(year, month);

  // Generate payslips for all active employees
  const res = await generatePayslipsForPeriod(period.id);
  console.log(`[INFO] Generated payslips for ${res.count} employees in ${month}/${year}.`);

  // Lock period
  await prisma.payrollPeriod.update({ where: { id: period.id }, data: { status: 'LOCKED' } });

  // Post
  const posted = await postPayrollPeriod(period.id);
  const journalId = posted.journal?.id;
  console.log(`[INFO] Posted journal ${posted.journal?.number || journalId}.`);

  // Fetch cost centers
  const natCc = await prisma.costCenter.findFirst({ where: { code: 'NAT' } });
  const expCc = await prisma.costCenter.findFirst({ where: { code: 'EXP' } });
  if (!expCc) throw new Error('Missing EXP cost center');

  const txns = await prisma.transaction.findMany({
    where: { journalEntryId: journalId },
    select: { id: true, kind: true, direction: true, amount: true, costCenterId: true },
  });
  const debits = txns.filter(t => t.direction === 'DEBIT' && (t.kind === 'SALARY_EXPENSE' || t.kind === 'SALARY_BONUS_EXPENSE'));

  const debNat = debits.filter(t => t.costCenterId && natCc && t.costCenterId === natCc.id);
  const debExp = debits.filter(t => t.costCenterId && t.costCenterId === expCc.id);

  console.log('[CHECK] Debits by CC:', {
    NAT: debNat.reduce((s, t) => s + Number(t.amount), 0).toFixed(2),
    EXP: debExp.reduce((s, t) => s + Number(t.amount), 0).toFixed(2),
  });

  if (debExp.length === 0) {
    throw new Error('Expected some salary debits allocated to EXP cost center (expatriate fallback).');
  }
  console.log('✅ EXP fallback allocation present.');
}

main()
  .catch((e) => {
    console.error('❌ test-payroll-expat-default-cc failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
