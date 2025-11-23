#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const posted = await prisma.payrollPeriod.findFirst({ where: { status: 'POSTED' }, orderBy: { openedAt: 'desc' } });
  if (!posted) { console.log('[reverse] No POSTED period'); await prisma.$disconnect(); return; }
  console.log('[reverse] Target', posted.id, posted.ref);
  const port = process.env.PORT || '3000';
  const res = await fetch(`http://localhost:${port}/api/payroll/period/${posted.id}/reverse`, { method: 'POST' });
  const json = await res.json();
  console.log('[reverse] HTTP', res.status, json);
  if (res.ok) {
    const after = await prisma.payrollPeriod.findUnique({ where: { id: posted.id } });
    console.log('[reverse] Reloaded status', after.status);
    const journals = await prisma.journalEntry.findMany({ where: { sourceType: 'PAYROLL', sourceId: posted.id }, orderBy: { date: 'desc' } });
    console.log('[reverse] Journal entries now:', journals.map(j=>j.number));
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
