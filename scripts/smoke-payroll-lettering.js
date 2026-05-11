#!/usr/bin/env node
// Smoke test: verify payroll liability transactions are lettered coherently in the general ledger.

import prisma from '../src/lib/prisma.js';
import { ensureLocalServer } from './lib/ensure-local-server.js';

function getArg(prefix) {
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function approxEqual(a, b, epsilon = 0.01) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
}

async function main() {
  const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000';
  const stopServer = await ensureLocalServer({
    baseUrl,
    healthPath: '/api/health',
    label: 'payroll-lettering-smoke',
    disableEnv: 'PAYROLL_START_SERVER',
  });

  try {
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
      console.log('[payroll-lettering-smoke] No SETTLED period found');
      return;
    }

    const res = await fetch(`${baseUrl}/api/payroll/period/${period.id}/lettering`, { method: 'GET' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) throw new Error(`Unable to fetch payroll lettering summary (${res.status})`);

    for (const item of json.items || []) {
      if (item.transactionCount === 0) continue;
      if (!item.letterRef) throw new Error(`Missing letterRef for ${item.liabilityCode}`);
      if (!approxEqual(item.letteredDebit, item.debitTotal)) throw new Error(`Debit lettering mismatch for ${item.liabilityCode}`);
      if (!approxEqual(item.letteredCredit, item.creditTotal)) throw new Error(`Credit lettering mismatch for ${item.liabilityCode}`);
      if (item.status !== 'MATCHED') throw new Error(`Expected MATCHED lettering for ${item.liabilityCode}, got ${item.status}`);
    }

    console.log(JSON.stringify({ period, status: 'OK', items: json.items }, null, 2));
  } finally {
    stopServer();
  }
}

main().catch((error) => {
  console.error('[payroll-lettering-smoke] failed:', error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
