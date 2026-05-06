#!/usr/bin/env node
/**
 * Backfill script: assign voucherRef to any MoneyMovement missing it.
 * Uses Prisma and the same sequence logic (MONEY_MOVEMENT) to generate references.
 */
import prisma from '../src/lib/prisma.js';
import { nextSequence as nextScopedSequence } from '../src/lib/sequence.js';

const args = process.argv.slice(2);
const companyArgIndex = args.indexOf('--companyId');
const companyId =
  companyArgIndex >= 0
    ? args[companyArgIndex + 1]
    : (process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || '').trim() || null;

if (!companyId) {
  throw new Error('companyId requis (--companyId ou DEFAULT_COMPANY_ID).');
}

function formatVoucher(prefix, date, num) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  return `${prefix}-${y}${m}-${String(num).padStart(4,'0')}`;
}

async function nextSequence(name, scopedCompanyId) {
  const raw = await nextScopedSequence(prisma, name, '', scopedCompanyId);
  return Number.parseInt(raw, 10);
}

async function run() {
  const toFix = await prisma.moneyMovement.findMany({
    where: { companyId, OR: [ { voucherRef: null }, { voucherRef: '' } ] },
    orderBy: { date: 'asc' },
  });
  if (!toFix.length) { console.log('Aucun mouvement sans voucherRef.'); return; }
  console.log(`Mouvements à corriger pour companyId=${companyId}:`, toFix.length);
  for (const mv of toFix) {
    const seqNum = await nextSequence('MONEY_MOVEMENT', companyId);
    const ref = formatVoucher('MV', mv.date, seqNum);
    await prisma.moneyMovement.update({ where: { id: mv.id }, data: { voucherRef: ref } });
    console.log('Assigné', ref, '->', mv.id);
  }
  console.log('Terminé.');
}

run().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
