#!/usr/bin/env node
/**
 * Computes current ledger totals (Σ Debit, Σ Credit) and net (Debit - Credit).
 * Optionally groups by account when --by-account is passed.
 */
import prisma from '../src/lib/prisma.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const companyIdx = args.indexOf('--companyId');
  return {
    byAccount: args.includes('--by-account'),
    companyId: companyIdx >= 0 ? args[companyIdx + 1] : null,
  };
}

(async () => {
  const { byAccount, companyId } = parseArgs();
  const txs = await prisma.transaction.findMany({
    where: companyId ? { companyId } : {},
    ...(byAccount
      ? {
          select: {
            amount: true,
            direction: true,
            accountId: true,
            account: { select: { number: true, label: true } },
          },
        }
      : {
          select: {
            amount: true,
            direction: true,
            accountId: true,
          },
        }),
  });
  let sumD = 0, sumC = 0;
  const perAccount = new Map();
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.direction === 'DEBIT') sumD += amt; else sumC += amt;
    if (byAccount) {
      const k = t.accountId;
      let acc = perAccount.get(k);
      if (!acc) {
        acc = {
          debit: 0,
          credit: 0,
          accountNumber: t.account?.number || null,
          accountLabel: t.account?.label || null,
        };
        perAccount.set(k, acc);
      }
      if (t.direction === 'DEBIT') acc.debit += amt; else acc.credit += amt;
    }
  }
  console.log('Ledger balance summary');
  if (companyId) console.log(`Scope companyId: ${companyId}`);
  console.log(`Total Debit : ${sumD.toFixed(2)}`);
  console.log(`Total Credit: ${sumC.toFixed(2)}`);
  console.log(`Net (D-C)  : ${(sumD - sumC).toFixed(2)}`);
  if (byAccount) {
    console.log('\nPer Account (non-zero net):');
    for (const [acct, v] of perAccount.entries()) {
      const net = v.debit - v.credit;
      if (Math.abs(net) > 0.0001) {
        const label = v.accountNumber ? `${v.accountNumber} ${v.accountLabel || ''}`.trim() : acct;
        console.log(`${label} => D ${v.debit.toFixed(2)} / C ${v.credit.toFixed(2)} / Net ${net.toFixed(2)}`);
      }
    }
  }
  await prisma.$disconnect();
})();
