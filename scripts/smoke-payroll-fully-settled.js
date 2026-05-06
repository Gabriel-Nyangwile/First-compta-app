#!/usr/bin/env node
// Smoke test: verify a posted payroll period is fully settled across net salary
// and all statutory liabilities.

import prisma from '../src/lib/prisma.js';

function getArg(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function approxEqual(a, b, epsilon = 0.01) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
}

async function main() {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const periodRefArg = getArg('--periodRef=');
  const periodIdArg = getArg('--periodId=');

  const period = periodIdArg
    ? await prisma.payrollPeriod.findFirst({ where: { id: periodIdArg, status: 'SETTLED' }, select: { id: true, ref: true } })
    : await prisma.payrollPeriod.findFirst({
        where: { ...(periodRefArg ? { ref: periodRefArg } : {}), status: 'SETTLED' },
        orderBy: [{ postedAt: 'desc' }, { year: 'desc' }, { month: 'desc' }],
        select: { id: true, ref: true },
      });

  if (!period) {
    console.log('[payroll-fully-settled] No SETTLED period found');
    return;
  }

  const response = await fetch(`${baseUrl}/api/payroll/period/${period.id}/summary`, { method: 'GET' });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(`Unable to fetch period summary (${response.status})`);
  }

  if (json.period.settlementStatus !== 'SETTLED') {
    throw new Error(`Expected period settlementStatus=SETTLED, got ${json.period.settlementStatus}`);
  }
  if (!approxEqual(json.totals?.remainingTotal, 0)) {
    throw new Error(`Expected totals.remainingTotal = 0, got ${json.totals?.remainingTotal}`);
  }
  if (!approxEqual(json.liabilityTotals?.remainingTotal, 0)) {
    throw new Error(`Expected liabilityTotals.remainingTotal = 0, got ${json.liabilityTotals?.remainingTotal}`);
  }
  if (!approxEqual(json.liabilityTotals?.overallTotal, json.liabilityTotals?.settledTotal)) {
    throw new Error(`Expected liabilityTotals.overallTotal == settledTotal, got ${json.liabilityTotals?.overallTotal} vs ${json.liabilityTotals?.settledTotal}`);
  }

  for (const liability of json.liabilities || []) {
    if (liability.settlementStatus !== 'SETTLED') {
      throw new Error(`Expected ${liability.code} to be SETTLED, got ${liability.settlementStatus}`);
    }
    if (!approxEqual(liability.remaining, 0)) {
      throw new Error(`Expected ${liability.code} remaining = 0, got ${liability.remaining}`);
    }
    if (!approxEqual(liability.total, liability.settled)) {
      throw new Error(`Expected ${liability.code} total == settled, got total=${liability.total}, settled=${liability.settled}`);
    }
  }

  const unsettledEmployees = (json.employees || []).filter((employee) => !employee.isSettled || !approxEqual(employee.remainingAmount, 0));
  if (unsettledEmployees.length) {
    throw new Error(`Expected all employees to be settled, found ${unsettledEmployees.length} unsettled`);
  }

  console.log(JSON.stringify({
    period,
    status: 'OK',
    periodSettlementStatus: json.period.settlementStatus,
    totals: json.totals,
    liabilityTotals: json.liabilityTotals,
    liabilities: json.liabilities,
    employeeCount: (json.employees || []).length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[payroll-fully-settled] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
