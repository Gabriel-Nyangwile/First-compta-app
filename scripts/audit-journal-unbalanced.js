// scripts/audit-journal-unbalanced.js
// Ce script détecte les écritures de journal déséquilibrées et propose une écriture OD d'ajustement (compte 471)
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('--- Audit des journaux déséquilibrés ---');
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
      console.log(`Journal ${j.number} du ${j.date.toISOString().slice(0,10)} : déséquilibre de ${diff} (${debit} / ${credit})`);
      console.log(`  → OD à passer : ${sens} 471 pour ${absDiff}`);
    }
  }
  if (count === 0) console.log('Aucun journal déséquilibré.');
  else console.log(`Total journaux déséquilibrés : ${count}`);
}

main().catch(e => { console.error(e); process.exit(1); });
