#!/usr/bin/env node
// Smoke test: poste le règlement net de la dernière période POSTED (dry-run par défaut).
import prisma from '../src/lib/prisma.js';

async function main() {
  const dryRun = !process.argv.includes('--execute');
  const period = await prisma.payrollPeriod.findFirst({ where: { status: 'POSTED' }, orderBy: { postedAt: 'desc' } });
  if (!period) { console.log('[settlement-smoke] No POSTED period found'); return; }
  const res = await fetch('http://localhost:3000/api/payroll/settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodId: period.id, dryRun }),
  });
  const json = await res.json();
  console.log('[settlement-smoke]', dryRun ? 'DRY-RUN' : 'EXEC', 'status', res.status, json);
  if (!res.ok) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
