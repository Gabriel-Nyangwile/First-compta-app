#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const period = await prisma.payrollPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { openedAt: 'desc' } });
  if (!period) { console.log('[lock] No OPEN period'); return; }
  console.log('[lock] Target', period.id, period.ref);
  const port = process.env.PORT || '3000';
  const res = await fetch(`http://localhost:${port}/api/payroll/period/${period.id}/lock`, { method: 'POST' });
  const json = await res.json();
  console.log('[lock] HTTP', res.status, json);
  if (res.ok) {
    const reloaded = await prisma.payrollPeriod.findUnique({ where: { id: period.id }, include: { payslips: true } });
    console.log('[lock] Reloaded status', reloaded.status, 'lockedAt', reloaded.lockedAt, 'payslipsLocked', reloaded.payslips.filter(p=>p.locked).length);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });