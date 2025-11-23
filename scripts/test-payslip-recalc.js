#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const ps = await prisma.payslip.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!ps) { console.log('[recalc] No payslip found'); return; }
  console.log('[recalc] Target', ps.id, ps.ref);
  const res = await fetch(`http://localhost:3000/api/payroll/payslips/${ps.id}/recalculate`, { method: 'POST' });
  const json = await res.json();
  console.log('[recalc] HTTP', res.status, json);
  if (res.ok) {
    const updated = await prisma.payslip.findUnique({ where: { id: ps.id }, include: { lines: true } });
    console.log('[recalc] Lines', updated.lines.length, 'Gross', updated.grossAmount.toString(), 'Net', updated.netAmount.toString());
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });