#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

function toNum(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function fetchPayrollAccounts(tx) {
  const mappings = await tx.payrollAccountMapping.findMany({ where: { active: true } });
  const index = Object.fromEntries(mappings.map(m => [m.code, m]));
  async function resolve(code) {
    const m = index[code];
    if (!m) throw new Error(`Missing payroll account mapping for code ${code}`);
    if (m.accountId) return m.accountId;
    if (!m.accountNumber) throw new Error(`Mapping ${code} missing accountNumber`);
    const acc = await tx.account.findFirst({ where: { number: m.accountNumber } });
    if (!acc) throw new Error(`Account ${m.accountNumber} for mapping ${code} not found`);
    return acc.id;
  }
  return {
    wagesSalary: await resolve('WAGES_NATIONAL_SALARIES'),
    wagesBonus: await resolve('WAGES_NATIONAL_BONUS'),
    employerSocial: await resolve('EMPLOYER_CONTRIB_NATIONAL'),
    netPay: await resolve('NET_PAY'),
    cnss: await resolve('CNSS'),
    inpp: await resolve('INPP'),
    onem: await resolve('ONEM'),
    payeTax: await resolve('PAYE_TAX'),
    benefitInKind: index['BENEFIT_IN_KIND'] ? await resolve('BENEFIT_IN_KIND') : null,
  };
}

async function main() {
  // args: --ref=PP-000000 or default to latest POSTED
  const argRef = process.argv.find(a => a.startsWith('--ref='))?.split('=')[1];
  const where = argRef ? { ref: argRef } : { status: 'POSTED' };
  const orderBy = argRef ? undefined : { postedAt: 'desc' };
  const period = argRef
    ? await prisma.payrollPeriod.findUnique({ where, include: { payslips: { include: { lines: true } } } })
    : await prisma.payrollPeriod.findFirst({ where, orderBy, include: { payslips: { include: { lines: true } } } });
  if (!period) { console.log('[audit] No POSTED period found'); await prisma.$disconnect(); return; }
  if (period.status !== 'POSTED') { console.log('[audit] Period is not POSTED:', period.ref, period.status); await prisma.$disconnect(); return; }

  // Aggregate payslip side
  let baseSalaryTotal = 0, bonusTotal = 0, employerSocialTotal = 0;
  let cnssEmpTotal = 0, cnssErTotal = 0, onemTotal = 0, inppTotal = 0, iprTotal = 0;
  let netTotal = 0, benefitInKindTotal = 0;
  for (const ps of period.payslips) {
    netTotal += toNum(ps.netAmount);
    for (const l of ps.lines) {
      const amt = toNum(l.amount);
      switch (l.code) {
        case 'BASE': if (amt > 0) baseSalaryTotal += amt; break;
        case 'PRIME': if (amt > 0) bonusTotal += amt; break;
        case 'CNSS_EMP': cnssEmpTotal += Math.abs(amt); break;
        case 'CNSS_ER': cnssErTotal += amt; employerSocialTotal += amt; break;
        case 'ONEM': onemTotal += amt; employerSocialTotal += amt; break;
        case 'INPP': inppTotal += amt; employerSocialTotal += amt; break;
        case 'IPR': iprTotal += Math.abs(amt); break;
        case 'AEN': if (amt > 0) benefitInKindTotal += amt; break;
        default: break;
      }
    }
  }

  // Load journal & transactions
  const journal = await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: period.id } });
  if (!journal) { console.log('[audit] No journal entry for period', period.ref); await prisma.$disconnect(); return; }
  const txns = await prisma.transaction.findMany({ where: { journalEntryId: journal.id } });
  const sumBy = (f) => round2(txns.filter(f).reduce((s,t)=> s + toNum(t.amount), 0));
  const accounts = await fetchPayrollAccounts(prisma);

  const ledger = {
    wagesSalary: sumBy(t => t.direction==='DEBIT' && t.accountId===accounts.wagesSalary),
    wagesBonus: sumBy(t => t.direction==='DEBIT' && t.accountId===accounts.wagesBonus),
    employerSocial: sumBy(t => t.direction==='DEBIT' && t.accountId===accounts.employerSocial),
    netPay: sumBy(t => t.direction==='CREDIT' && t.accountId===accounts.netPay),
    cnssEmp: sumBy(t => t.direction==='CREDIT' && t.accountId===accounts.cnss && t.kind==='EMPLOYEE_SOCIAL_WITHHOLDING'),
    cnssEr: sumBy(t => t.direction==='CREDIT' && t.accountId===accounts.cnss && t.kind==='EMPLOYER_SOCIAL_WITHHOLDING'),
    onem: sumBy(t => t.direction==='CREDIT' && t.accountId===accounts.onem),
    inpp: sumBy(t => t.direction==='CREDIT' && t.accountId===accounts.inpp),
    ipr: sumBy(t => t.direction==='CREDIT' && t.accountId===accounts.payeTax),
    aen: accounts.benefitInKind ? sumBy(t => t.direction==='DEBIT' && t.accountId===accounts.benefitInKind) : 0,
    debitTotal: sumBy(t => t.direction==='DEBIT'),
    creditTotal: sumBy(t => t.direction==='CREDIT'),
  };

  const slips = {
    base: round2(baseSalaryTotal),
    bonus: round2(bonusTotal),
    employerSocial: round2(employerSocialTotal),
    net: round2(netTotal),
    cnssEmp: round2(cnssEmpTotal),
    cnssEr: round2(cnssErTotal),
    onem: round2(onemTotal),
    inpp: round2(inppTotal),
    ipr: round2(iprTotal),
    aen: round2(benefitInKindTotal),
  };

  function diff(a, b) { return round2(a - b); }
  const report = [
    ['Salary expense (base)', slips.base, ledger.wagesSalary, diff(ledger.wagesSalary, slips.base)],
    ['Salary expense (bonus)', slips.bonus, ledger.wagesBonus, diff(ledger.wagesBonus, slips.bonus)],
    ['Employer social expense', slips.employerSocial, ledger.employerSocial, diff(ledger.employerSocial, slips.employerSocial)],
    ['Net payable', slips.net, ledger.netPay, diff(ledger.netPay, slips.net)],
    ['CNSS employee', slips.cnssEmp, ledger.cnssEmp, diff(ledger.cnssEmp, slips.cnssEmp)],
    ['CNSS employer', slips.cnssEr, ledger.cnssEr, diff(ledger.cnssEr, slips.cnssEr)],
    ['ONEM', slips.onem, ledger.onem, diff(ledger.onem, slips.onem)],
    ['INPP', slips.inpp, ledger.inpp, diff(ledger.inpp, slips.inpp)],
    ['IPR tax', slips.ipr, ledger.ipr, diff(ledger.ipr, slips.ipr)],
    ['Benefits in kind', slips.aen, ledger.aen, diff(ledger.aen, slips.aen)],
  ];

  const tol = 0.01;
  const mismatches = report.filter(([, , , d]) => Math.abs(d) > tol);
  console.log(`[audit] Period ${period.ref} Journal ${journal.number}`);
  for (const [label, slipsVal, ledgerVal, delta] of report) {
    console.log(label.padEnd(24), 'slips=', slipsVal.toFixed(2), 'ledger=', ledgerVal.toFixed(2), 'delta=', delta.toFixed(2));
  }
  console.log('Totals: debit=', ledger.debitTotal.toFixed(2), 'credit=', ledger.creditTotal.toFixed(2));
  if (Math.abs(ledger.debitTotal - ledger.creditTotal) > tol) {
    console.log('[audit] ERROR: Journal not balanced.');
  }
  if (mismatches.length) {
    console.log(`[audit] FAIL: ${mismatches.length} mismatches over tolerance.`);
    process.exitCode = 2;
  } else {
    console.log('[audit] OK: All reconciliations within tolerance.');
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
