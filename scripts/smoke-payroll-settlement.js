#!/usr/bin/env node
// Smoke test: poste le règlement net de la dernière période POSTED (dry-run par défaut).
import prisma from '../src/lib/prisma.js';

async function main() {
  const dryRun = !process.argv.includes('--execute');
  const liabilityCodeArg = process.argv.find((arg) => arg.startsWith('--liability='));
  const liabilityCode = liabilityCodeArg ? liabilityCodeArg.split('=')[1] : 'NET_PAY';
  const period = await prisma.payrollPeriod.findFirst({ where: { status: 'POSTED' }, orderBy: { postedAt: 'desc' } });
  if (!period) { console.log('[settlement-smoke] No POSTED period found'); return; }
  const bank = process.env.PAYROLL_BANK_NUMBER || process.env.NEXT_PUBLIC_PAYROLL_BANK_NUMBER;
  const res = await fetch('http://localhost:3000/api/payroll/settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodId: period.id, dryRun, accountNumber: bank, liabilityCode }),
  });
  const json = await res.json();
  console.log('[settlement-smoke]', liabilityCode, dryRun ? 'DRY-RUN' : 'EXEC', 'status', res.status, json);
  if (!res.ok) {
    const message = String(json?.error || '');
    if (dryRun && /already fully settled/i.test(message)) return;
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
