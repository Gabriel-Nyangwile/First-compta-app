#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';
import { postPayrollSettlement } from '../src/lib/payroll/settlement.js';

/**
 * Règle le net à payer d'une période POSTED.
 * Usage: node --env-file=.env.local scripts/payroll-settlement.js --ref=PP-000123 [--accountNumber=521000] [--dry-run]
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key) => args.find(a => a.startsWith(`--${key}=`))?.split('=')[1];
  return {
    ref: get('ref'),
    accountNumber: get('accountNumber'),
    companyId: get('companyId') || process.env.DEFAULT_COMPANY_ID || null,
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const { ref, accountNumber, companyId, dryRun } = parseArgs();
  if (!ref) {
    console.error('Usage: node scripts/payroll-settlement.js --ref=PP-000123 [--accountNumber=521000] [--companyId=<uuid>] [--dry-run]');
    process.exit(1);
  }
  const period = await prisma.payrollPeriod.findFirst({ where: { ref, ...(companyId ? { companyId } : {}) } });
  if (!period) throw new Error(`Période ${ref} introuvable`);
  const res = await postPayrollSettlement(period.id, { accountNumber, dryRun, companyId: companyId || period.companyId || null });
  console.log('[settlement]', dryRun ? 'DRY-RUN' : 'DONE', res);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
