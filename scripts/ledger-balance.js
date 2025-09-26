#!/usr/bin/env node
/**
 * Computes current ledger totals (Σ Debit, Σ Credit) and net (Debit - Credit).
 * Optionally groups by account when --by-account is passed.
 */
import prisma from '../src/lib/prisma.js';

function parseArgs() {
  const args = process.argv.slice(2);
  return { byAccount: args.includes('--by-account') };
}

(async () => {
  const { byAccount } = parseArgs();
  const txs = await prisma.transaction.findMany({ select: { amount: true, direction: true, accountId: true } });
  let sumD = 0, sumC = 0;
  const perAccount = new Map();
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.direction === 'DEBIT') sumD += amt; else sumC += amt;
    if (byAccount) {
      const k = t.accountId;
      let acc = perAccount.get(k);
      if (!acc) { acc = { debit: 0, credit: 0 }; perAccount.set(k, acc); }
      if (t.direction === 'DEBIT') acc.debit += amt; else acc.credit += amt;
    }
  }
  console.log('Ledger balance summary');
  console.log(`Total Debit : ${sumD.toFixed(2)}`);
  console.log(`Total Credit: ${sumC.toFixed(2)}`);
  console.log(`Net (D-C)  : ${(sumD - sumC).toFixed(2)}`);
  if (byAccount) {
    console.log('\nPer Account (non-zero net):');
    for (const [acct, v] of perAccount.entries()) {
      const net = v.debit - v.credit;
      if (Math.abs(net) > 0.0001) {
        console.log(`${acct} => D ${v.debit.toFixed(2)} / C ${v.credit.toFixed(2)} / Net ${net.toFixed(2)}`);
      }
    }
  }
  await prisma.$disconnect();
})();
