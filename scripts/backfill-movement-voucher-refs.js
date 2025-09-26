#!/usr/bin/env node
/**
 * Backfill script: assign voucherRef to any MoneyMovement missing it.
 * Uses Prisma and the same sequence logic (MONEY_MOVEMENT) to generate references.
 */
import prisma from '../src/lib/prisma.js';

function formatVoucher(prefix, date, num) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  return `${prefix}-${y}${m}-${String(num).padStart(4,'0')}`;
}

async function nextSequence(name) {
  return await prisma.$transaction(async (tx) => {
    let seq = await tx.sequence.findUnique({ where: { name } });
    if (!seq) {
      seq = await tx.sequence.create({ data: { name, value: 1 } });
      return seq.value;
    }
    const updated = await tx.sequence.update({ where: { name }, data: { value: { increment: 1 } } });
    return updated.value;
  });
}

async function run() {
  const toFix = await prisma.moneyMovement.findMany({ where: { OR: [ { voucherRef: null }, { voucherRef: '' } ] }, orderBy: { date: 'asc' } });
  if (!toFix.length) { console.log('Aucun mouvement sans voucherRef.'); return; }
  console.log('Mouvements à corriger:', toFix.length);
  for (const mv of toFix) {
    const seqNum = await nextSequence('MONEY_MOVEMENT');
    const ref = formatVoucher('MV', mv.date, seqNum);
    await prisma.moneyMovement.update({ where: { id: mv.id }, data: { voucherRef: ref } });
    console.log('Assigné', ref, '->', mv.id);
  }
  console.log('Terminé.');
}

run().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
