// src/lib/payroll/engine.js
// Minimal payroll engine v1 for RDC: gross, CNSS 5%/5%, ONEM 0.5% (employer), INPP 3% (employer 1–50), IPR brackets.
// Notes:
// - FX currently assumed = 1 (EUR≈CDF) until FxRate feeding is implemented.
// - Frais professionnels assumed 25% of (gross - CNSS_salarie) if not provided in TaxRule meta.
// - Base salary is taken from Position -> Bareme.legalSalary snapshot; primes default to 0 in v1.

import prisma from '../prisma.js';
import { nextSequence } from '../sequence.js';

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function getActiveSchemes() {
  const list = await prisma.contributionScheme.findMany({ where: { active: true } });
  const byCode = Object.fromEntries(list.map(s => [s.code, s]));
  return { list, byCode };
}

export async function getIprRule() {
  const rule = await prisma.taxRule.findFirst({ where: { code: 'IPR_RDC_2025', active: true } });
  return rule;
}

function computeIprMonthlyCDF(riCDF, rule) {
  if (!riCDF || riCDF <= 0) return 0;
  // Annual progressive then convert back to monthly.
  const annualRI = Math.max(0, riCDF * 12);
  const brackets = Array.isArray(rule?.brackets) ? rule.brackets : [];
  let annualTax = 0;
  let prevMax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i];
    const upper = b.max == null ? Infinity : b.max;
    if (annualRI <= prevMax) break;
    const span = Math.min(annualRI, upper) - prevMax;
    if (span > 0) {
      annualTax += span * toNumber(b.rate);
    }
    prevMax = upper === Infinity ? annualRI : upper;
  }
  let monthlyTax = annualTax / 12;
  // Cap: plafonnement_impot_pourcentage_max expressed as % of RI (monthly). If absent, default 30%.
  const limitPct = typeof rule?.meta?.minRule?.plafonnement_impot_pourcentage_max === 'number'
    ? rule.meta.minRule.plafonnement_impot_pourcentage_max
    : 30;
  const cap = (limitPct / 100) * riCDF;
  monthlyTax = Math.min(monthlyTax, cap);
  // Minimum absolute tax after charges (interpreted as annual threshold divided by 12)
  const minCdfAnnual = rule?.meta?.minRule?.impot_minimum_apres_charges_cdf;
  if (typeof minCdfAnnual === 'number' && minCdfAnnual > 0 && monthlyTax > 0) {
    const minMonthly = minCdfAnnual / 12;
    if (monthlyTax < minMonthly) monthlyTax = minMonthly;
  }
  // Safety: tax cannot exceed RI
  // Safety: tax cannot exceed capped RI portion nor RI itself
  monthlyTax = Math.min(monthlyTax, cap, riCDF);
  return round2(monthlyTax);
}

async function getFxRateForPeriod(baseCurrency, quoteCurrency, year, month) {
  // Use last day of month
  const targetDate = new Date(Date.UTC(year, month - 1, 1));
  // Find latest rate <= first day of period month (could shift to end-of-month once available)
  const rate = await prisma.fxRate.findFirst({
    where: { baseCurrency, quoteCurrency, date: { lte: targetDate } },
    orderBy: { date: 'desc' }
  });
  return rate?.rate?.toNumber?.() ?? 1;
}

export async function calculatePayslipForEmployee(employee, periodContext = null) {
  // Base salary from Position.Bareme
  const baseSalary = toNumber(employee?.position?.bareme?.legalSalary) || 0;
  // Simulated primes via feature flag
  // Enable with PAYROLL_SIMULATE_PRIME=(1|true|>0). Optional rate with PAYROLL_SIMULATE_PRIME_RATE (e.g., 0.1 for 10%).
  let primes = 0;
  const simulatePrimeFlag = process.env.PAYROLL_SIMULATE_PRIME;
  const flagTruthy = simulatePrimeFlag === '1'
    || simulatePrimeFlag?.toLowerCase?.() === 'true'
    || (!Number.isNaN(Number(simulatePrimeFlag)) && Number(simulatePrimeFlag) > 0);
  if (flagTruthy) {
    const rateRaw = process.env.PAYROLL_SIMULATE_PRIME_RATE ?? '0.10';
    const rate = Number(rateRaw);
    const primeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0.10;
    primes = round2(baseSalary * primeRate);
  }
  // Simulated AEN (benefits in kind) via feature flag
  let aen = 0;
  const aenFlag = process.env.PAYROLL_SIMULATE_AEN;
  const aenTruthy = aenFlag === '1'
    || aenFlag?.toLowerCase?.() === 'true'
    || (!Number.isNaN(Number(aenFlag)) && Number(aenFlag) > 0);
  if (aenTruthy) {
    const aenRateRaw = process.env.PAYROLL_SIMULATE_AEN_RATE ?? '0.05';
    const aenRateNum = Number(aenRateRaw);
    const aenRate = Number.isFinite(aenRateNum) && aenRateNum >= 0 ? aenRateNum : 0.05;
    aen = round2(baseSalary * aenRate);
  }
  // Attendance pro-rata (Phase A): if attendance exists and workingDays > 0, pro-rate base
  let baseAfterAttendance = baseSalary;
  let attendance = null;
  if (periodContext?.id && employee?.id) {
    attendance = await prisma.employeeAttendance.findUnique({
      where: { periodId_employeeId: { periodId: periodContext.id, employeeId: employee.id } },
    });
    const dw = toNumber(attendance?.daysWorked);
    const wd = toNumber(attendance?.workingDays);
    if (wd > 0 && dw >= 0) {
      baseAfterAttendance = round2(baseSalary * (dw / wd));
    }
  }

  let variables = [];
  if (periodContext?.id && employee?.id) {
    variables = await prisma.payrollVariable.findMany({ where: { periodId: periodContext.id, employeeId: employee.id } });
  }

  // Sum variable impacts
  let variablesPrimeTotal = 0;
  let variablesDeductionTotal = 0;
  const variableAllocations = [];
  for (const v of variables) {
    const amt = toNumber(v.amount);
    if (v.kind === 'DEDUCTION') {
      variablesDeductionTotal += Math.abs(amt);
    } else {
      variablesPrimeTotal += amt; // BONUS/ALLOWANCE
      if (amt > 0 && v.costCenterId) {
        variableAllocations.push({ costCenterId: v.costCenterId, amount: amt });
      }
    }
  }

  // Overtime monetization (Phase A): hourly rate from legal base over workingDays * hoursPerDay
  const hoursPerDay = Number(process.env.PAYROLL_HOURS_PER_DAY ?? 8) || 8;
  const otMultiplier = Number(process.env.PAYROLL_OVERTIME_MULTIPLIER ?? 1.5) || 1.5;
  const wdForRate = toNumber(attendance?.workingDays) || 30;
  const otHours = toNumber(attendance?.overtimeHours) || 0;
  const baseHourly = wdForRate > 0 && hoursPerDay > 0 ? (baseSalary / (wdForRate * hoursPerDay)) : 0;
  const overtimeAmount = round2(baseHourly * otHours * otMultiplier);

  const gross = baseAfterAttendance + variablesPrimeTotal + aen + primes + overtimeAmount;

  // Load schemes and tax
  const { byCode } = await getActiveSchemes();
  const iprRule = await getIprRule();

  // CNSS salarie 5% on BRUT for v1 (practical; RI-based would require circular solve)
  const cnssEmpRate = toNumber(byCode?.CNSS?.employeeRate) || 0.05;
  const cnssEmp = round2(gross * cnssEmpRate);
  // Frais pro 25% default (can be overridden in meta later)
  const fraisPct = 0.25;
  const frais = round2((gross - cnssEmp) * fraisPct);
  // RI in base currency (EUR assumption)
  const riBase = Math.max(0, gross - cnssEmp - frais);
  // FX conversion for tax (EUR->CDF) using period context if provided
  let fxRate = 1;
  if (periodContext) {
    fxRate = await getFxRateForPeriod('EUR', 'CDF', periodContext.year, periodContext.month);
  }
  const riCDF = round2(riBase * fxRate);
  const iprCDF = iprRule ? computeIprMonthlyCDF(riCDF, iprRule) : 0;
  // Convert IPR back to base currency for net calculation
  const ipr = round2(iprCDF / fxRate);

  // Employer contributions
  const cnssErRate = toNumber(byCode?.CNSS?.employerRate) || 0.05;
  const cnssEr = round2(gross * cnssErRate);
  const onemRate = toNumber(byCode?.ONEM?.employerRate) || 0.005;
  const onem = round2(gross * onemRate);
  const inppRate = toNumber(byCode?.INPP_1_50?.employerRate) || 0.03;
  const inpp = round2(gross * inppRate);

  const net = round2(gross - cnssEmp - ipr); // AEN non-liquidative ignoré v1

  // Build lines
  const lines = [];
  lines.push({ kind: 'BASE', code: 'BASE', label: 'Salaire de base', amount: round2(baseAfterAttendance), baseAmount: null, order: 10, meta: attendance ? { daysWorked: toNumber(attendance.daysWorked), workingDays: toNumber(attendance.workingDays) } : undefined });
  if (primes) lines.push({ kind: 'PRIME', code: 'PRIME', label: 'Primes', amount: round2(primes), baseAmount: null, order: 20 });
  if (aen) lines.push({ kind: 'BASE', code: 'AEN', label: 'Avantages en nature', amount: round2(aen), baseAmount: null, order: 25 });
  if (variablesPrimeTotal) lines.push({ kind: 'PRIME', code: 'VAR+', label: 'Variables positives', amount: round2(variablesPrimeTotal), baseAmount: null, order: 27 });
  if (overtimeAmount) lines.push({ kind: 'PRIME', code: 'OT', label: 'Heures supplémentaires', amount: overtimeAmount, baseAmount: null, order: 28, meta: { otHours, hoursPerDay, otMultiplier, baseHourly: round2(baseHourly) } });
  lines.push({ kind: 'COTISATION_SALARIALE', code: 'CNSS_EMP', label: 'CNSS part salarié 5%', amount: -cnssEmp, baseAmount: round2(gross), order: 30, meta: { rate: cnssEmpRate } });
  lines.push({ kind: 'IMPOT', code: 'IPR', label: 'IPR (mensuel)', amount: -round2(ipr), baseAmount: round2(riBase), order: 40, meta: { riCDF, fxRate, iprCDF } });
  if (variablesDeductionTotal) lines.push({ kind: 'RETENUE', code: 'VAR-', label: 'Variables négatives', amount: -round2(variablesDeductionTotal), baseAmount: null, order: 45 });
  lines.push({ kind: 'COTISATION_PATRONALE', code: 'CNSS_ER', label: 'CNSS part employeur 5%', amount: round2(cnssEr), baseAmount: round2(gross), order: 50, meta: { rate: cnssErRate } });
  lines.push({ kind: 'COTISATION_PATRONALE', code: 'ONEM', label: 'ONEM 0.5%', amount: round2(onem), baseAmount: round2(gross), order: 60, meta: { rate: onemRate } });
  lines.push({ kind: 'COTISATION_PATRONALE', code: 'INPP', label: 'INPP 3%', amount: round2(inpp), baseAmount: round2(gross), order: 70, meta: { rate: inppRate } });

  return {
    grossAmount: round2(gross),
    netAmount: net,
    employerChargesTotal: round2(cnssEr + onem + inpp),
    lines,
    variableAllocations,
  };
}

export async function recalculatePayslip(payslipId) {
  const p = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: { employee: { include: { position: { include: { bareme: true } } }, costAllocations: true } },
  });
  if (!p) throw new Error('Payslip not found');
  // Load period for FX context
  const period = await prisma.payrollPeriod.findUnique({ where: { id: p.periodId } });
  const res = await calculatePayslipForEmployee(p.employee, period);
  // Replace non-manual lines (in v1: replace all)
  await prisma.$transaction(async (tx) => {
    await tx.payslipLine.deleteMany({ where: { payslipId } });
    await tx.payslip.update({ where: { id: payslipId }, data: { grossAmount: res.grossAmount, netAmount: res.netAmount } });
    for (const [i, l] of res.lines.entries()) {
      await tx.payslipLine.create({ data: { payslipId, kind: l.kind, code: l.code, label: l.label, amount: l.amount, baseAmount: l.baseAmount ?? null, order: l.order ?? (i * 10), meta: l.meta ?? null } });
    }
    await tx.payslipCostAllocation.deleteMany({ where: { payslipId } });
    const allocs = p.employee?.costAllocations?.map(a => ({ costCenterId: a.costCenterId, percent: toNumber(a.percent) })) || [];
    const direct = res.variableAllocations?.map(v => ({ costCenterId: v.costCenterId, amount: v.amount })) || [];
    if (allocs.length || direct.length) {
      const rounded = distributeAllocations(res.grossAmount, allocs, direct);
      for (const a of rounded) {
        await tx.payslipCostAllocation.create({ data: { payslipId, costCenterId: a.costCenterId, percent: a.percent, amount: a.amount } });
      }
    }
  });
  return res;
}

export async function generatePayslipsForPeriod(periodId) {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new Error('Period not found');
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' }, include: { position: { include: { bareme: true } }, costAllocations: true } });
  const results = [];
  await prisma.$transaction(async (tx) => {
    for (const e of employees) {
      // Upsert payslip
      const existing = await tx.payslip.findFirst({ where: { employeeId: e.id, periodId } });
      const ps = existing || await (async () => {
        const ref = await nextSequence(tx, 'PAYSLIP', 'PSL-');
        return tx.payslip.create({ data: { employeeId: e.id, periodId, ref, grossAmount: 0, netAmount: 0 } });
      })();
      const calc = await calculatePayslipForEmployee(e, period);
      // Reset lines
      await tx.payslipLine.deleteMany({ where: { payslipId: ps.id } });
      await tx.payslip.update({ where: { id: ps.id }, data: { grossAmount: calc.grossAmount, netAmount: calc.netAmount } });
      for (const [i, l] of calc.lines.entries()) {
        await tx.payslipLine.create({ data: { payslipId: ps.id, kind: l.kind, code: l.code, label: l.label, amount: l.amount, baseAmount: l.baseAmount ?? null, order: l.order ?? (i * 10), meta: l.meta ?? null } });
      }
      await tx.payslipCostAllocation.deleteMany({ where: { payslipId: ps.id } });
      const allocs = e.costAllocations?.map(a => ({ costCenterId: a.costCenterId, percent: toNumber(a.percent) })) || [];
      const direct = calc.variableAllocations?.map(v => ({ costCenterId: v.costCenterId, amount: v.amount })) || [];
      if (allocs.length || direct.length) {
        const rounded = distributeAllocations(calc.grossAmount, allocs, direct);
        for (const a of rounded) {
          await tx.payslipCostAllocation.create({ data: { payslipId: ps.id, costCenterId: a.costCenterId, percent: a.percent, amount: a.amount } });
        }
      }
      results.push({ employeeId: e.id, payslipId: ps.id, ...calc });
    }
  });
  return { count: results.length, results };
}

function distributeAllocations(total, allocs, directAllocations = []) {
  if (!total) return [];
  const normalized = (allocs || []).filter(a => a.costCenterId && a.percent > 0);
  const direct = (directAllocations || []).filter(d => d.costCenterId && d.amount > 0);
  const directSum = direct.reduce((s, d) => s + d.amount, 0);
  const distributable = Math.max(0, total - directSum);
  const rounded = [];
  if (normalized.length && distributable > 0) {
    let sumRounded = 0;
    for (let i = 0; i < normalized.length; i++) {
      const a = normalized[i];
      const part = i < normalized.length - 1 ? round2(distributable * a.percent) : round2(distributable - sumRounded);
      rounded.push({ ...a, amount: part });
      sumRounded += part;
    }
  }
  // Inject direct allocations (variables avec costCenterId)
  for (const d of direct) {
    rounded.push({ costCenterId: d.costCenterId, amount: round2(d.amount), percent: total ? round2(d.amount / total) : d.percent });
  }
  // Recompute percent for all entries to reflect share of total
  if (total > 0) {
    return rounded.map((r, idx) => {
      const pct = total ? round2(r.amount / total) : 0;
      return { ...r, percent: pct };
    });
  }
  return rounded;
}
