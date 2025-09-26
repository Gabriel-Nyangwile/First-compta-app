#!/usr/bin/env node
/**
 * Backfill des comptes comptables (ledgerAccount) manquants pour MoneyAccount.
 * Règles PCG demandées:
 *  BANK  -> 521100, 521200, 521300 ... (incrément +100)
 *  CASH  -> 571100, 571200, 571300 ...
 * Si un ledgerAccount est déjà présent, on le laisse intact.
 */
import prisma from '../src/lib/prisma.js';

async function nextNumber(prefix) {
  const existing = await prisma.account.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
  let maxTail = 0;
  for (const acc of existing) {
    if (acc.number.length === 6 && acc.number.startsWith(prefix)) {
      const tail = acc.number.substring(3);
      const num = parseInt(tail, 10);
      if (!isNaN(num) && num > maxTail) maxTail = num;
    }
  }
  const nextTail = maxTail === 0 ? 100 : maxTail + 100;
  return prefix + String(nextTail).padStart(3, '0');
}

async function run() {
  const moneyAccounts = await prisma.moneyAccount.findMany({ include: { ledgerAccount: true } });
  let created = 0;
  for (const ma of moneyAccounts) {
    if (ma.ledgerAccountId) continue; // already has one
    const prefix = ma.type === 'BANK' ? '521' : '571';
    const number = await nextNumber(prefix);
    let label;
    if (ma.type === 'CASH') {
      const tail = number.substring(3);
      switch (tail) {
        case '100': label = 'Caisse Monnaie locale'; break;
        case '200': label = 'Caisse Devise 1'; break;
        case '300': label = 'Caisse Devise 2'; break;
        default: label = 'Caisse ' + (ma.label || tail); break;
      }
    } else {
      label = 'Banque ' + (ma.label || number.substring(3));
    }
    const acc = await prisma.account.create({ data: { number, label } });
    await prisma.moneyAccount.update({ where: { id: ma.id }, data: { ledgerAccountId: acc.id } });
    created++;
    console.log(`Provisioned ledger account ${number} for moneyAccount ${ma.id}`);
  }
  console.log(`Backfill terminé. Nouveaux comptes créés: ${created}`);
}

run().then(()=>process.exit(0)).catch(e=>{ console.error(e); process.exit(1); });
