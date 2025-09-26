import prisma from '../src/lib/prisma.js';
import { createMoneyMovement, computeMoneyAccountBalance } from '../src/lib/serverActions/money.js';
import { Prisma } from '@prisma/client';

async function main() {
  // Crée un compte de trésorerie test
  const ledger = await prisma.account.create({ data: { number: '530TEST'+Date.now(), label: 'Caisse Test Ledger' } });
  const acc = await prisma.moneyAccount.create({ data: { type: 'CASH', label: 'Caisse Test', openingBalance: new Prisma.Decimal(100), ledgerAccountId: ledger.id } });
  console.log('Compte créé', acc.id);
  const m1 = await createMoneyMovement({ moneyAccountId: acc.id, amount: 50, direction: 'IN', kind: 'OTHER', description: 'Encaissement test' });
  console.log('Mouvement 1', m1.id);
  const m2 = await createMoneyMovement({ moneyAccountId: acc.id, amount: 30, direction: 'OUT', kind: 'OTHER', description: 'Décaissement test' });
  console.log('Mouvement 2', m2.id);
  const balance = await computeMoneyAccountBalance(acc.id);
  console.log('Solde attendu 100 + 50 - 30 = 120 =>', balance.toString());
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
