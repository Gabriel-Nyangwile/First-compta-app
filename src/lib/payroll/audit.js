import prisma from '../prisma.js';

function toNum(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function fetchPayrollAccounts(db) {
  const mappings = await db.payrollAccountMapping.findMany({ where: { active: true } });
  const index = Object.fromEntries(mappings.map(m => [m.code, m]));
  async function resolve(code) {
    const m = index[code];
    if (!m) throw new Error(`Missing payroll account mapping for code ${code}`);
    if (m.accountId) return m.accountId;
    if (!m.accountNumber) throw new Error(`Mapping ${code} missing accountNumber`);
    const acc = await db.account.findFirst({ where: { number: m.accountNumber } });
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

export async function auditPayrollPeriod(periodId, db = prisma) {
  const period = await db.payrollPeriod.findUnique({ where: { id: periodId }, include: { payslips: { include: { lines: true } } } });
  if (!period) throw new Error('Period not found');
  const journal = await db.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: period.id } });
  if (!journal) throw new Error('No journal linked to period');

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

  const txns = await db.transaction.findMany({ where: { journalEntryId: journal.id } });
  const sumBy = (f) => round2(txns.filter(f).reduce((s,t)=> s + toNum(t.amount), 0));
  const accounts = await fetchPayrollAccounts(db);
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
  const rows = [
    { label: 'Salary expense (base)', slips: slips.base, ledger: ledger.wagesSalary, delta: diff(ledger.wagesSalary, slips.base) },
    { label: 'Salary expense (bonus)', slips: slips.bonus, ledger: ledger.wagesBonus, delta: diff(ledger.wagesBonus, slips.bonus) },
    { label: 'Employer social expense', slips: slips.employerSocial, ledger: ledger.employerSocial, delta: diff(ledger.employerSocial, slips.employerSocial) },
    { label: 'Net payable', slips: slips.net, ledger: ledger.netPay, delta: diff(ledger.netPay, slips.net) },
    { label: 'CNSS employee', slips: slips.cnssEmp, ledger: ledger.cnssEmp, delta: diff(ledger.cnssEmp, slips.cnssEmp) },
    { label: 'CNSS employer', slips: slips.cnssEr, ledger: ledger.cnssEr, delta: diff(ledger.cnssEr, slips.cnssEr) },
    { label: 'ONEM', slips: slips.onem, ledger: ledger.onem, delta: diff(ledger.onem, slips.onem) },
    { label: 'INPP', slips: slips.inpp, ledger: ledger.inpp, delta: diff(ledger.inpp, slips.inpp) },
    { label: 'IPR tax', slips: slips.ipr, ledger: ledger.ipr, delta: diff(ledger.ipr, slips.ipr) },
    { label: 'Benefits in kind', slips: slips.aen, ledger: ledger.aen, delta: diff(ledger.aen, slips.aen) },
  ];
  const tol = 0.01;
  const mismatchCount = rows.filter(r => Math.abs(r.delta) > tol).length;
  const balanced = Math.abs(ledger.debitTotal - ledger.creditTotal) <= tol;
  return {
    periodRef: period.ref,
    journalNumber: journal.number,
    rows,
    debitTotal: ledger.debitTotal,
    creditTotal: ledger.creditTotal,
    balanced,
    mismatchCount,
  };
}
