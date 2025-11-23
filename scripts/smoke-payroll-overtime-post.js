#!/usr/bin/env node
// Smoke: set overtime for one employee, recalc, lock, post, and print journal totals
// Usage: node scripts/smoke-payroll-overtime-post.js [overtimeHours]

import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function ensureOpenPeriodWithPayslips() {
  let period = await prisma.payrollPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
  if (!period) {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-');
    period = await prisma.payrollPeriod.create({ data: { ref, month, year, status: 'OPEN' } });
    console.log('[smoke-ot] Created OPEN period', period.ref);
  }
  // Ensure at least one payslip exists; generate via HTTP route
  const payslipCount = await prisma.payslip.count({ where: { periodId: period.id } });
  if (!payslipCount) {
    const port = process.env.PORT || '3000';
    const genRes = await fetch(`http://localhost:${port}/api/payroll/period/${period.id}/generate`, { method: 'POST' });
    const genJson = await genRes.json().catch(()=>({}));
    console.log('[smoke-ot] Generate HTTP', genRes.status, genJson);
    if (!genRes.ok) throw new Error('Failed to generate payslips');
  }
  return await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { payslips: { include: { employee: true } } } });
}

async function setOvertime(period, hours) {
  // Pick the first payslip's employee
  const target = period.payslips[0];
  if (!target) throw new Error('No payslip in period');
  const employeeId = target.employeeId;
  // Upsert attendance with full working days to avoid base proration and set overtime hours
  const days = 30;
  const att = await prisma.employeeAttendance.upsert({
    where: { periodId_employeeId: { periodId: period.id, employeeId } },
    update: { daysWorked: days, workingDays: days, overtimeHours: hours, notes: 'smoke overtime' },
    create: { periodId: period.id, employeeId, daysWorked: days, workingDays: days, overtimeHours: hours, notes: 'smoke overtime' },
  });
  console.log('[smoke-ot] Attendance set for employee', employeeId, 'overtimeHours', hours);
  return att;
}

async function recalc(periodId) {
  const port = process.env.PORT || '3000';
  const url = `http://localhost:${port}/api/payroll/period/${periodId}/generate`;
  const res = await fetch(url, { method: 'POST' });
  const json = await res.json().catch(()=>({}));
  console.log('[smoke-ot] Recalc HTTP', res.status, json);
  if (!res.ok) throw new Error('Recalc failed');
}

async function lock(periodId) {
  const port = process.env.PORT || '3000';
  const res = await fetch(`http://localhost:${port}/api/payroll/period/${periodId}/lock`, { method: 'POST' });
  const json = await res.json().catch(()=>({}));
  console.log('[smoke-ot] Lock HTTP', res.status, json);
  if (!res.ok) throw new Error('Lock failed');
}

async function post(periodId) {
  const port = process.env.PORT || '3000';
  const res = await fetch(`http://localhost:${port}/api/payroll/period/${periodId}/post`, { method: 'POST' });
  const json = await res.json().catch(()=>({}));
  console.log('[smoke-ot] Post HTTP', res.status, json);
  if (!res.ok) throw new Error('Post failed');
}

async function printJournal(periodId) {
  const journal = await prisma.journalEntry.findFirst({ where: { sourceType: 'PAYROLL', sourceId: periodId }, orderBy: { date: 'desc' } });
  if (!journal) { console.log('[smoke-ot] No journal found'); return; }
  const txns = await prisma.transaction.findMany({ where: { journalEntryId: journal.id } });
  const debit = txns.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + toNumber(t.amount), 0);
  const credit = txns.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + toNumber(t.amount), 0);
  const bonus = txns.filter(t => t.kind === 'SALARY_BONUS_EXPENSE').reduce((s, t) => s + toNumber(t.amount), 0);
  const salary = txns.filter(t => t.kind === 'SALARY_EXPENSE').reduce((s, t) => s + toNumber(t.amount), 0);
  console.log('[smoke-ot] Journal', journal.number, 'debit', debit.toFixed(2), 'credit', credit.toFixed(2));
  console.log('[smoke-ot] Prime split: bonus', bonus.toFixed(2), 'base', salary.toFixed(2));
}

async function maybeReverseAndUnlock(periodId) {
  const port = process.env.PORT || '3000';
  // Reverse only if POSTED
  const afterPost = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (afterPost?.status !== 'POSTED') {
    console.log('[smoke-ot] Skip reversal: status', afterPost?.status);
    return;
  }
  const revRes = await fetch(`http://localhost:${port}/api/payroll/period/${periodId}/reverse`, { method: 'POST' });
  const revJson = await revRes.json().catch(()=>({}));
  console.log('[smoke-ot] Reverse HTTP', revRes.status, revJson);
  if (!revRes.ok) throw new Error('Reverse failed');
  // Now unlock (period is LOCKED after reversal)
  const unRes = await fetch(`http://localhost:${port}/api/payroll/period/${periodId}/unlock`, { method: 'POST' });
  const unJson = await unRes.json().catch(()=>({}));
  console.log('[smoke-ot] Unlock HTTP', unRes.status, unJson);
  if (!unRes.ok) throw new Error('Unlock failed');
  const final = await prisma.payrollPeriod.findUnique({ where: { id: periodId }, include: { payslips: true } });
  console.log('[smoke-ot] Final status', final.status, 'payslipsLocked', final.payslips.filter(p=>p.locked).length);
}

async function main() {
  const args = process.argv.slice(2);
  const hoursArg = args.find(a => /^\d+(\.\d+)?$/.test(a));
  const hours = Number(hoursArg || 10);
  const open = await ensureOpenPeriodWithPayslips();
  await setOvertime(open, hours);
  await recalc(open.id);
  await lock(open.id);
  await post(open.id);
  await printJournal(open.id);
  // Always revert to leave environment clean for iterative tests
  await maybeReverseAndUnlock(open.id);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
