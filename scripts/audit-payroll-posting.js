#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';
import { auditPayrollPeriod } from '../src/lib/payroll/audit.js';

/**
 * Options:
 *  --ref=PP-000000   Audit cette période précise (doit être POSTED)
 *  --all             Audit toutes les périodes POSTED
 *
 * Par défaut : dernière période POSTED.
 */

async function auditOne(period) {
  if (!period) return { ok: false, error: 'Period not found' };
  if (period.status !== 'POSTED') return { ok: false, error: `Period ${period.ref} not POSTED (status=${period.status})` };
  const res = await auditPayrollPeriod(period.id, prisma);
  const mismatches = res.rows?.filter(r => Math.abs(r.delta) > 0.01)?.length || 0;
  const balanced = Math.abs((res.debitTotal || 0) - (res.creditTotal || 0)) <= 0.01;
  const ok = mismatches === 0 && balanced;
  return { ok, mismatches, balanced, audit: res, ref: period.ref, journal: res.journalNumber };
}

async function main() {
  const argRef = process.argv.find(a => a.startsWith('--ref='))?.split('=')[1];
  const runAll = process.argv.includes('--all');

  if (runAll) {
    const periods = await prisma.payrollPeriod.findMany({ where: { status: 'POSTED' }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
    if (!periods.length) { console.log('[audit] No POSTED period found'); await prisma.$disconnect(); return; }
    let failures = 0;
    for (const p of periods) {
      const res = await auditOne(p);
      console.log(`[audit] ${p.ref}: ${res.ok ? 'OK' : 'FAIL'} | mismatches=${res.mismatches} balanced=${res.balanced} journal=${res.journal || '-'}`);
      if (!res.ok) failures++;
    }
    if (failures) process.exitCode = 2;
    await prisma.$disconnect();
    return;
  }

  const period = argRef
    ? await prisma.payrollPeriod.findUnique({ where: { ref: argRef } })
    : await prisma.payrollPeriod.findFirst({ where: { status: 'POSTED' }, orderBy: { postedAt: 'desc' } });
  if (!period) { console.log('[audit] No POSTED period found'); await prisma.$disconnect(); return; }

  const res = await auditOne(period);
  if (!res.ok) {
    console.log('[audit] FAIL', res.error || `Period ${period.ref}`);
    process.exitCode = 2;
  } else {
    console.log(`[audit] OK ${period.ref} journal=${res.journal} mismatches=${res.mismatches} balanced=${res.balanced}`);
    // afficher détail
    res.audit?.rows?.forEach(r => {
      console.log(r.label.padEnd(24), 'slips=', r.slips.toFixed(2), 'ledger=', r.ledger.toFixed(2), 'delta=', r.delta.toFixed(2));
    });
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
