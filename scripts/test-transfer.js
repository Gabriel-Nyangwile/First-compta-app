import prisma from '../src/lib/prisma.js';
import { createTransfer } from '../src/lib/serverActions/money.js';
import { Prisma } from '@prisma/client';

async function main() {
  // Crée deux comptes (avec ledgerAccountId fictif si besoin). On suppose existence de comptes comptables.
  // Pour le test on crée deux comptes comptables simples si absent.
  const acc1Ledger = await prisma.account.create({ data: { number: '512000TEST'+Date.now(), label: 'Banque Test 1' } });
  const acc2Ledger = await prisma.account.create({ data: { number: '512001TEST'+Date.now(), label: 'Banque Test 2' } });
  const m1 = await prisma.moneyAccount.create({ data: { type: 'BANK', label: 'Banque A', ledgerAccountId: acc1Ledger.id } });
  const m2 = await prisma.moneyAccount.create({ data: { type: 'BANK', label: 'Banque B', ledgerAccountId: acc2Ledger.id } });
  const amount = 250;
  const { out, in: inMv, group } = await createTransfer({ fromMoneyAccountId: m1.id, toMoneyAccountId: m2.id, amount, description: 'Transfert test' });
  console.log('Transfer group', group, 'out', out.id, 'in', inMv.id);
  const txsOut = await prisma.transaction.findMany({ where: { moneyMovementId: out.id } });
  const txsIn = await prisma.transaction.findMany({ where: { moneyMovementId: inMv.id } });
  console.log('Transactions OUT count', txsOut.length, 'IN count', txsIn.length);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
