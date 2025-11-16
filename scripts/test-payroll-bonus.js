// scripts/test-payroll-bonus.js
// Validate bonus simulation end-to-end without HTTP server.
// Usage: node scripts/test-payroll-bonus.js [year] [month] [rate]

import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';
import { generatePayslipsForPeriod } from '../src/lib/payroll/engine.js';

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function run() {
  const year = Number(process.argv[2] || 2025);
  const month = Number(process.argv[3] || 12);
  const rateRaw = process.argv[4];

  // Enable PRIME simulation via env for this process
  process.env.PAYROLL_SIMULATE_PRIME = process.env.PAYROLL_SIMULATE_PRIME || '1';
  if (rateRaw) process.env.PAYROLL_SIMULATE_PRIME_RATE = rateRaw;

  console.log(`[bonus-test] Simulate PRIME enabled, rate=${process.env.PAYROLL_SIMULATE_PRIME_RATE || '0.10'}`);

  // Create a fresh period
  const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-');
  const period = await prisma.payrollPeriod.create({ data: { ref, month, year, status: 'OPEN' } });

  // Generate payslips using engine
  await generatePayslipsForPeriod(period.id);

  // Load payslips with lines
  const full = await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { payslips: { include: { lines: true } } } });

  let baseSalaryTotal = 0;
  let bonusTotal = 0;
  let employerSocialTotal = 0;
  let cnssEmpTotal = 0;
  let cnssErTotal = 0;
  let onemTotal = 0;
  let inppTotal = 0;
  let iprTotal = 0;
  let netTotal = 0;
  let benefitInKindTotal = 0;

  for (const ps of full.payslips) {
    netTotal += toNumber(ps.netAmount);
    for (const l of ps.lines) {
      const amt = toNumber(l.amount);
      switch (l.code) {
        case 'BASE': baseSalaryTotal += (amt > 0 ? amt : 0); break;
        case 'PRIME': bonusTotal += (amt > 0 ? amt : 0); break;
        case 'CNSS_EMP': cnssEmpTotal += Math.abs(amt); break;
        case 'CNSS_ER': cnssErTotal += amt; employerSocialTotal += amt; break;
        case 'ONEM': onemTotal += amt; employerSocialTotal += amt; break;
        case 'INPP': inppTotal += amt; employerSocialTotal += amt; break;
        case 'IPR': iprTotal += Math.abs(amt); break;
        case 'AEN': benefitInKindTotal += (amt > 0 ? amt : 0); break;
        default: break;
      }
    }
  }

  const debits = [];
  const credits = [];
  if (baseSalaryTotal > 0) debits.push({ kind: 'SALARY_EXPENSE', amount: baseSalaryTotal });
  if (bonusTotal > 0) debits.push({ kind: 'SALARY_BONUS_EXPENSE', amount: bonusTotal });
  if (benefitInKindTotal > 0) debits.push({ kind: 'BENEFIT_IN_KIND_EXPENSE', amount: benefitInKindTotal });
  if (employerSocialTotal > 0) debits.push({ kind: 'EMPLOYER_SOCIAL_EXPENSE', amount: employerSocialTotal });
  if (netTotal > 0) credits.push({ kind: 'WAGES_PAYABLE', amount: netTotal });
  if (cnssEmpTotal > 0) credits.push({ kind: 'EMPLOYEE_SOCIAL_WITHHOLDING', amount: cnssEmpTotal });
  if (cnssErTotal > 0) credits.push({ kind: 'EMPLOYER_SOCIAL_WITHHOLDING', amount: cnssErTotal });
  if (onemTotal > 0) credits.push({ kind: 'OTHER_PAYROLL_LIABILITY', amount: onemTotal });
  if (inppTotal > 0) credits.push({ kind: 'OTHER_PAYROLL_LIABILITY', amount: inppTotal });
  if (iprTotal > 0) credits.push({ kind: 'INCOME_TAX_WITHHOLDING', amount: iprTotal });

  const sum = (rows) => rows.reduce((s, r) => s + toNumber(r.amount), 0);
  const totalDeb = sum(debits);
  const totalCred = sum(credits);

  console.log('[bonus-test] Period:', full.ref);
  console.log('[bonus-test] Debits:', debits.map((t) => `${t.kind}:${toNumber(t.amount).toFixed(2)}`));
  console.log('[bonus-test] Credits:', credits.map((t) => `${t.kind}:${toNumber(t.amount).toFixed(2)}`));
  console.log('[bonus-test] Balance (debits-credits):', (totalDeb - totalCred).toFixed(2));

  // Assertions
  const hasBonus = debits.some(d => d.kind === 'SALARY_BONUS_EXPENSE' && toNumber(d.amount) > 0);
  const hasSalary = debits.some(d => d.kind === 'SALARY_EXPENSE' && toNumber(d.amount) > 0);
  const balanced = Math.abs(totalDeb - totalCred) < 0.01;

  if (!hasSalary) {
    console.error('[bonus-test] FAIL: Missing SALARY_EXPENSE debit');
    process.exit(2);
  }
  if (!hasBonus) {
    console.error('[bonus-test] FAIL: Missing SALARY_BONUS_EXPENSE debit (enable env or check engine)');
    process.exit(3);
  }
  if (!balanced) {
    console.error('[bonus-test] FAIL: Not balanced');
    process.exit(4);
  }
  console.log('[bonus-test] OK');
  process.exit(0);
}

run().catch((e) => {
  console.error('[bonus-test] ERROR', e?.message || e);
  process.exit(1);
});
