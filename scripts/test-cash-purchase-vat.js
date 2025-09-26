import prisma from '../src/lib/prisma.js';
import { createMoneyMovement } from '../src/lib/serverActions/money.js';
import { Prisma } from '@prisma/client';

async function main() {
  // Compte ledger caisse
  const ledgerCash = await prisma.account.create({ data: { number: '530VAT'+Date.now(), label: 'Caisse TVA' } });
  const purchaseAccount = await prisma.account.create({ data: { number: '6061'+Date.now(), label: 'Achats Marchandises' } });
  const cash = await prisma.moneyAccount.create({ data: { type: 'CASH', label: 'Caisse TVA Test', openingBalance: new Prisma.Decimal(500), ledgerAccountId: ledgerCash.id } });
  const total = 120; // 100 HT + 20 TVA
  const mv = await createMoneyMovement({
    moneyAccountId: cash.id,
    amount: total,
    direction: 'OUT',
    kind: 'CASH_PURCHASE',
    description: 'Achat fournitures multi-taux simple',
    counterpartAccountId: purchaseAccount.id,
    vatBreakdown: [{ rate: 0.20, base: 100 }]
  });
  console.log('Mouvement achat cash id', mv.id);
  const txs = await prisma.transaction.findMany({ where: { moneyMovementId: mv.id } });
  console.log('Ecritures liées:', txs.map(t=>({dir:t.direction, kind:t.kind, amt:t.amount.toString(), acc:t.accountId})));
}

main().catch(e=>{console.error(e); process.exit(1);}).finally(async ()=>{ await prisma.$disconnect(); });
