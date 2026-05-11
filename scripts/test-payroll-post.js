#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';
import { ensureLocalServer } from './lib/ensure-local-server.js';
import { getFallbackRateToCdf } from '../src/lib/payroll/currency.js';

async function ensurePeriodFxRate(baseUrl, period) {
  if (period.processingCurrency === period.fiscalCurrency || Number(period.fxRate || 0) > 0) {
    return period;
  }

  const fxRate = getFallbackRateToCdf(period.processingCurrency);
  const res = await fetch(`${baseUrl}/api/payroll/period/${period.id}/currency`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fxRate }),
  });
  const json = await res.json().catch(() => ({}));
  console.log('[post] currency', res.status, json);
  if (!res.ok) throw new Error(`[post] Failed to set payroll fxRate: ${res.status}`);
  return json.period;
}

async function main() {
  const port = process.env.PORT || '3000';
  const baseUrl = process.env.BASE_URL || process.env.APP_URL || `http://localhost:${port}`;
  const stopServer = await ensureLocalServer({
    baseUrl,
    healthPath: '/api/health',
    label: 'test-payroll-post',
    disableEnv: 'PAYROLL_START_SERVER',
  });

  try {
    const now = new Date();
    let period = await prisma.payrollPeriod.findFirst({ where: { status: 'LOCKED' }, orderBy: { lockedAt: 'desc' } });

    if (!period) {
      period = await prisma.payrollPeriod.findFirst({
        where: { status: 'OPEN', month: now.getMonth() + 1, year: now.getFullYear() },
        orderBy: { openedAt: 'desc' },
      });
    }

    if (!period) {
      console.log('[post] No LOCKED/OPEN period, creating one for current month...');
      const body = JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() });
      const created = await fetch(`${baseUrl}/api/payroll/period`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const createdJson = await created.json().catch(() => ({}));
      if (!created.ok) throw new Error(`[post] Failed to create period: ${created.status} ${JSON.stringify(createdJson)}`);
      period = createdJson.period;
      console.log('[post] Created', period.id, period.ref);
    }

    if (period.status === 'OPEN') {
      period = await ensurePeriodFxRate(baseUrl, period);
      const gen = await fetch(`${baseUrl}/api/payroll/period/${period.id}/generate`, { method: 'POST' });
      const genJson = await gen.json();
      console.log('[post] generate', gen.status, genJson);

      const lock = await fetch(`${baseUrl}/api/payroll/period/${period.id}/lock`, { method: 'POST' });
      const lockJson = await lock.json();
      console.log('[post] lock', lock.status, lockJson);
      if (!lock.ok) throw new Error('[post] Failed to lock generated period');
    } else {
      console.log('[post] Target', period.id, period.ref);
    }

    const res = await fetch(`${baseUrl}/api/payroll/period/${period.id}/post`, { method: 'POST' });
    const json = await res.json();
    console.log('[post] HTTP', res.status, json);
    if (res.ok) {
      const reloaded = await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { payslips: true } });
      console.log('[post] Reloaded status', reloaded.status, 'postedAt', reloaded.postedAt);
      const journal = await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: period.id } });
      if (journal) {
        const txns = await prisma.transaction.findMany({ where: { journalEntryId: journal.id } });
        const debit = txns.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + Number(t.amount?.toNumber?.() ?? t.amount), 0);
        const credit = txns.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + Number(t.amount?.toNumber?.() ?? t.amount), 0);
        console.log('[post] Journal', journal.number, 'debit', debit.toFixed(2), 'credit', credit.toFixed(2));
      }
    }
  } finally {
    stopServer();
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
