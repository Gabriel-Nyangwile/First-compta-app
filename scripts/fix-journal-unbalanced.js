// scripts/fix-journal-unbalanced.js
// Ce script ajoute une écriture OD (compte 471) pour équilibrer chaque journal déséquilibré
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

async function main() {
  console.log('--- Correction automatique des journaux déséquilibrés ---');
  // 1. Parcourir tous les JournalEntry
  const journals = await prisma.journalEntry.findMany({
    include: { lines: true },
    orderBy: { date: 'asc' }
  });
  let count = 0;
  for (const j of journals) {
    let debit = 0, credit = 0;
    for (const l of j.lines) {
      const amt = Number(l.amount?.toNumber?.() ?? l.amount);
      if (l.direction === 'DEBIT') debit += amt;
      else if (l.direction === 'CREDIT') credit += amt;
    }
    if (debit !== credit) {
      count++;
      const diff = +(debit - credit).toFixed(2);
      const sens = diff > 0 ? 'CREDIT' : 'DEBIT';
      const absDiff = Math.abs(diff);
      // Chercher le compte 471 (OD)
      let odAccount = await prisma.account.findFirst({ where: { number: '471' } });
      if (!odAccount) {
        odAccount = await prisma.account.create({ data: { number: '471', label: 'Compte d’attente OD', description: 'Auto-créé pour OD équilibrage' } });
      }
      // Créer la transaction d’ajustement
      const tx = await prisma.transaction.create({
        data: {
          date: j.date,
          amount: absDiff,
          direction: sens,
          accountId: odAccount.id,
          description: 'Ajustement OD auto (équilibrage)',
          kind: 'ADJUSTMENT',
          journalEntryId: j.id
        }
      });
      console.log(`Journal ${j.number} corrigé : ajout ${sens} 471 pour ${absDiff}`);
    }
  }
  if (count === 0) console.log('Aucun journal déséquilibré.');
  else console.log(`Total journaux corrigés : ${count}`);
}

main().catch(e => { console.error(e); process.exit(1); });
