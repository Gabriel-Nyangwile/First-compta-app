#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const port = process.env.PORT || '3000';
  let period = await prisma.payrollPeriod.findFirst({ where: { status: 'LOCKED' }, orderBy: { lockedAt: 'desc' } });

  if (!period) {
    console.log('[post] No LOCKED period, creating one for current month...');
    const now = new Date();
    const body = JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() });
    const created = await fetch(`http://localhost:${port}/api/payroll/period`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!created.ok) throw new Error(`[post] Failed to create period: ${created.status}`);
    const createdJson = await created.json();
    period = createdJson.period;
    console.log('[post] Created', period.id, period.ref);
    const gen = await fetch(`http://localhost:${port}/api/payroll/period/${period.id}/generate`, { method: 'POST' });
    const genJson = await gen.json();
    console.log('[post] generate', gen.status, genJson);
    const lock = await fetch(`http://localhost:${port}/api/payroll/period/${period.id}/lock`, { method: 'POST' });
    const lockJson = await lock.json();
    console.log('[post] lock', lock.status, lockJson);
    if (!lock.ok) throw new Error('[post] Failed to lock generated period');
  } else {
    console.log('[post] Target', period.id, period.ref);
  }

  const res = await fetch(`http://localhost:${port}/api/payroll/period/${period.id}/post`, { method: 'POST' });
  const json = await res.json();
  console.log('[post] HTTP', res.status, json);
  if (res.ok) {
    const reloaded = await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { payslips: true } });
    console.log('[post] Reloaded status', reloaded.status, 'postedAt', reloaded.postedAt);
    const journal = await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: period.id } });
    if (journal) {
      const txns = await prisma.transaction.findMany({ where: { journalEntryId: journal.id } });
      const debit = txns.filter(t=>t.direction==='DEBIT').reduce((s,t)=> s + Number(t.amount?.toNumber?.() ?? t.amount), 0);
      const credit = txns.filter(t=>t.direction==='CREDIT').reduce((s,t)=> s + Number(t.amount?.toNumber?.() ?? t.amount), 0);
      console.log('[post] Journal', journal.number, 'debit', debit.toFixed(2), 'credit', credit.toFixed(2));
    }
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
