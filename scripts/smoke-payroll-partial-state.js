#!/usr/bin/env node
// Smoke test: verify a posted payroll period can have all statutory liabilities settled
// while net salary remains partially settled.

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
    ? await prisma.payrollPeriod.findFirst({ where: { id: periodIdArg, status: 'POSTED' }, select: { id: true, ref: true } })
    : await prisma.payrollPeriod.findFirst({ where: { ...(periodRefArg ? { ref: periodRefArg } : {}), status: 'POSTED' }, orderBy: { postedAt: 'desc' }, select: { id: true, ref: true } });

  if (!period) {
    console.log('[payroll-partial-state] No POSTED period found');
    return;
  }

  const response = await fetch(`${baseUrl}/api/payroll/period/${period.id}/summary`, { method: 'GET' });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(`Unable to fetch period summary (${response.status})`);
  }

  const liabilities = new Map((json.liabilities || []).map((item) => [item.code, item]));
  const net = liabilities.get('NET_PAY');
  const cnss = liabilities.get('CNSS');
  const onem = liabilities.get('ONEM');
  const inpp = liabilities.get('INPP');
  const ipr = liabilities.get('PAYE_TAX');

  if (!net || !cnss || !onem || !inpp || !ipr) {
    throw new Error('Missing one or more required liabilities in period summary');
  }

  if (json.period.settlementStatus !== 'PARTIAL_SETTLEMENT') {
    throw new Error(`Expected period settlementStatus=PARTIAL_SETTLEMENT, got ${json.period.settlementStatus}`);
  }
  if (net.settlementStatus !== 'PARTIAL_SETTLEMENT') {
    throw new Error(`Expected NET_PAY partial settlement, got ${net.settlementStatus}`);
  }
  if (!(Number(net.remaining || 0) > 0.005)) {
    throw new Error(`Expected NET_PAY remaining > 0, got ${net.remaining}`);
  }

  for (const liability of [cnss, onem, inpp, ipr]) {
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

  const expectedSettledTotal = Number(net.settled || 0) + Number(cnss.settled || 0) + Number(onem.settled || 0) + Number(inpp.settled || 0) + Number(ipr.settled || 0);
  if (!approxEqual(json.liabilityTotals?.settledTotal, expectedSettledTotal)) {
    throw new Error(`Expected liabilityTotals.settledTotal=${expectedSettledTotal.toFixed(2)}, got ${json.liabilityTotals?.settledTotal}`);
  }

  console.log(JSON.stringify({
    period,
    status: 'OK',
    periodSettlementStatus: json.period.settlementStatus,
    netPay: {
      settled: net.settled,
      remaining: net.remaining,
      settlementStatus: net.settlementStatus,
    },
    statutoryLiabilities: [cnss, onem, inpp, ipr].map((item) => ({
      code: item.code,
      total: item.total,
      settled: item.settled,
      remaining: item.remaining,
      settlementStatus: item.settlementStatus,
    })),
    liabilityTotals: json.liabilityTotals,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[payroll-partial-state] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });