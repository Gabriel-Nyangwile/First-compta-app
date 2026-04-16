#!/usr/bin/env node
// Smoke test: validate payroll liability settlements (CNSS / ONEM / INPP / IPR)
// against the API and period summary. Dry-run by default; use --execute to post
// remaining liabilities for the target period.

import prisma from '../src/lib/prisma.js';

const LIABILITY_CODES = ['CNSS', 'ONEM', 'INPP', 'PAYE_TAX'];

function getArg(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function main() {
  const dryRun = !process.argv.includes('--execute');
  const periodRefArg = getArg('--periodRef=');
  const periodIdArg = getArg('--periodId=');
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const period = periodIdArg
    ? await prisma.payrollPeriod.findFirst({ where: { id: periodIdArg, status: 'POSTED' }, select: { id: true, ref: true } })
    : await prisma.payrollPeriod.findFirst({ where: { ...(periodRefArg ? { ref: periodRefArg } : {}), status: 'POSTED' }, orderBy: { postedAt: 'desc' }, select: { id: true, ref: true } });

  if (!period) {
    console.log('[payroll-liability-smoke] No POSTED period found');
    return;
  }

  const summaryBefore = await fetchJson(`${baseUrl}/api/payroll/period/${period.id}/summary`, { method: 'GET' });
  if (!summaryBefore.response.ok || !summaryBefore.json?.ok) {
    throw new Error(`Unable to fetch period summary before test (${summaryBefore.response.status})`);
  }

  const liabilityMapBefore = new Map((summaryBefore.json.liabilities || []).map((item) => [item.code, item]));
  const results = [];

  for (const liabilityCode of LIABILITY_CODES) {
    const liabilityBefore = liabilityMapBefore.get(liabilityCode);
    if (!liabilityBefore) {
      throw new Error(`Liability ${liabilityCode} missing from period summary`);
    }

    const body = {
      periodId: period.id,
      liabilityCode,
      dryRun,
    };
    const { response, json } = await fetchJson(`${baseUrl}/api/payroll/settlement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = String(json?.error || 'Unknown settlement error');
      if (dryRun && /already fully settled/i.test(message) && liabilityBefore.remaining <= 0.005) {
        results.push({ liabilityCode, mode: 'DRY-RUN', status: 'ALREADY_SETTLED_OK', message });
        continue;
      }
      throw new Error(`[${liabilityCode}] ${message}`);
    }

    if (dryRun) {
      const remainingToSettle = Number(json.remainingToSettle || 0);
      const expectedRemaining = Number(liabilityBefore.remaining || 0);
      if (Math.abs(remainingToSettle - expectedRemaining) > 0.01) {
        throw new Error(`[${liabilityCode}] Dry-run mismatch: expected ${expectedRemaining.toFixed(2)}, got ${remainingToSettle.toFixed(2)}`);
      }
      results.push({ liabilityCode, mode: 'DRY-RUN', status: 'OK', remainingToSettle });
    } else {
      results.push({ liabilityCode, mode: 'EXEC', status: 'OK', settlementRef: json.settlementRef, journalNumber: json.journalNumber, settledTotal: json.settledTotal });
    }
  }

  const summaryAfter = await fetchJson(`${baseUrl}/api/payroll/period/${period.id}/summary`, { method: 'GET' });
  if (!summaryAfter.response.ok || !summaryAfter.json?.ok) {
    throw new Error(`Unable to fetch period summary after test (${summaryAfter.response.status})`);
  }

  const settlementsCsv = await fetch(`${baseUrl}/api/payroll/period/${period.id}/settlements?format=csv`, { method: 'GET' });
  const settlementsCsvText = await settlementsCsv.text();
  if (!settlementsCsv.ok || !settlementsCsvText.includes('liabilityCode')) {
    throw new Error('Unable to fetch settlements CSV after test');
  }

  console.log(JSON.stringify({
    period,
    mode: dryRun ? 'DRY-RUN' : 'EXEC',
    results,
    liabilitiesAfter: summaryAfter.json.liabilities,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[payroll-liability-smoke] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });