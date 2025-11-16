#!/usr/bin/env node
// Validate payroll postings split across cost centers for salary and bonus.
// Creates minimal personnel data (Bareme, Position, Employee) and two CostCenters,
// assigns allocations 60/40, generates payslips, locks and posts period,
// then asserts SALARY_EXPENSE and SALARY_BONUS_EXPENSE are split accordingly with costCenterId set.

import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';
import { generatePayslipsForPeriod } from '../src/lib/payroll/engine.js';
import { postPayrollPeriod } from '../src/lib/payroll/postings.js';

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function upsertCostCenter(code, label) {
  const existing = await prisma.costCenter.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.costCenter.create({ data: { code, label, active: true } });
}

async function ensurePersonnel(baseSalary = 1000) {
  // Create Bareme, Position, Employee
  const bareme = await prisma.bareme.create({ data: { category: 'A1', legalSalary: baseSalary, categoryDescription: 'Test', tension: 'N/A' } });
  const position = await prisma.position.create({ data: { title: 'Agent Test', baremeId: bareme.id } });
  const employee = await prisma.employee.create({ data: { firstName: 'Test', lastName: 'Employee', status: 'ACTIVE', positionId: position.id } });
  return { bareme, position, employee };
}

async function run() {
  const year = Number(process.argv[2] || 2025);
  const month = Number(process.argv[3] || 12);

  // Enable PRIME simulation to exercise bonus allocation as well
  process.env.PAYROLL_SIMULATE_PRIME = process.env.PAYROLL_SIMULATE_PRIME || '1';
  process.env.PAYROLL_SIMULATE_PRIME_RATE = process.env.PAYROLL_SIMULATE_PRIME_RATE || '0.10';

  // Prepare unique cost centers and one employee with allocations 60/40
  const uniq = Date.now().toString(36);
  const [ccProd, ccAdm] = await Promise.all([
    upsertCostCenter(`PROD_${uniq}`, 'Production'),
    upsertCostCenter(`ADM_${uniq}`, 'Administration'),
  ]);

  const { employee } = await ensurePersonnel(1000);

  // Ensure allocations (idempotent-ish for this employee)
  await prisma.employeeCostAllocation.deleteMany({ where: { employeeId: employee.id } });
  await prisma.employeeCostAllocation.createMany({ data: [
    { employeeId: employee.id, costCenterId: ccProd.id, percent: 0.6 },
    { employeeId: employee.id, costCenterId: ccAdm.id, percent: 0.4 },
  ]});

  // Fresh period
  const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-');
  let period = await prisma.payrollPeriod.create({ data: { ref, month, year, status: 'OPEN' } });

  // Generate payslips
  const gen = await generatePayslipsForPeriod(period.id);
  if (gen.count <= 0) {
    console.error('[cc-test] FAIL: No payslips generated');
    process.exit(2);
  }

  // Lock period and post
  period = await prisma.payrollPeriod.update({ where: { id: period.id }, data: { status: 'LOCKED', lockedAt: new Date() } });
  const posted = await postPayrollPeriod(period.id);

  const txns = posted.transactions || [];
  const debits = txns.filter(t => t.direction === 'DEBIT');
  const credits = txns.filter(t => t.direction === 'CREDIT');
  const sum = (rows) => rows.reduce((s, r) => s + toNumber(r.amount), 0);
  const totalDeb = sum(debits);
  const totalCred = sum(credits);

  // Collect salary and bonus debits by cost center
  const salaryRows = debits.filter(t => t.kind === 'SALARY_EXPENSE');
  const bonusRows = debits.filter(t => t.kind === 'SALARY_BONUS_EXPENSE');

  const byCc = (rows) => rows.reduce((acc, r) => { const k = r.costCenterId || 'NULL'; acc[k] = (acc[k] || 0) + toNumber(r.amount); return acc; }, {});
  const salaryByCc = byCc(salaryRows);
  const bonusByCc = byCc(bonusRows);

  // Expected base and bonus from our single employee's payslip
  const full = await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { payslips: { include: { lines: true }, where: { employeeId: employee.id } } } });
  const ps = full?.payslips?.[0];
  if (!ps) {
    console.error('[cc-test] FAIL: Payslip for test employee not found');
    process.exit(3);
  }
  const base = round2(ps.lines.filter(l => l.code === 'BASE').reduce((s, l) => s + Math.max(0, toNumber(l.amount)), 0));
  const bonus = round2(ps.lines.filter(l => l.code === 'PRIME').reduce((s, l) => s + Math.max(0, toNumber(l.amount)), 0));

  const expectProdBase = round2(base * 0.6);
  const expectAdmBase = round2(base - expectProdBase);
  const expectProdBonus = round2(bonus * 0.6);
  const expectAdmBonus = round2(bonus - expectProdBonus);

  const gotProdBase = round2(salaryByCc[ccProd.id] || 0);
  const gotAdmBase = round2(salaryByCc[ccAdm.id] || 0);
  const gotProdBonus = round2(bonusByCc[ccProd.id] || 0);
  const gotAdmBonus = round2(bonusByCc[ccAdm.id] || 0);

  console.log('[cc-test] Salary by CC:', { [ccProd.code]: gotProdBase, [ccAdm.code]: gotAdmBase }, 'expected', { [ccProd.code]: expectProdBase, [ccAdm.code]: expectAdmBase });
  console.log('[cc-test] Bonus by CC:', { [ccProd.code]: gotProdBonus, [ccAdm.code]: gotAdmBonus }, 'expected', { [ccProd.code]: expectProdBonus, [ccAdm.code]: expectAdmBonus });
  console.log('[cc-test] Balance (debits-credits):', round2(totalDeb - totalCred).toFixed(2));

  // Assertions
  const tol = 0.01;
  const rowsForOurCC = salaryRows.filter(r => r.costCenterId === ccProd.id || r.costCenterId === ccAdm.id);
  const hasCcOnSalary = rowsForOurCC.length >= 2 && rowsForOurCC.every(r => !!r.costCenterId);
  const balanced = Math.abs(totalDeb - totalCred) < 0.01;

  if (!hasCcOnSalary) {
    console.error('[cc-test] FAIL: Some salary debit rows missing costCenterId');
    process.exit(4);
  }
  if (Math.abs(gotProdBase - expectProdBase) > tol || Math.abs(gotAdmBase - expectAdmBase) > tol) {
    console.error('[cc-test] FAIL: Salary allocation mismatch');
    process.exit(5);
  }
  if (bonus > 0 && (Math.abs(gotProdBonus - expectProdBonus) > tol || Math.abs(gotAdmBonus - expectAdmBonus) > tol)) {
    console.error('[cc-test] FAIL: Bonus allocation mismatch');
    process.exit(6);
  }
  if (!balanced) {
    console.error('[cc-test] FAIL: Not balanced');
    process.exit(7);
  }

  console.log('[cc-test] OK');
  process.exit(0);
}

run().catch(async (e) => {
  console.error('[cc-test] ERROR', e?.message || e);
  await prisma.$disconnect();
  process.exit(1);
});
