#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({ include: { account: { select: { id:true, number:true, label:true } } } });
  const map = new Map();
  for (const t of txs) {
    const k = t.account.id;
    if (!map.has(k)) map.set(k, { number: t.account.number, label: t.account.label, debit:0, credit:0 });
    const g = map.get(k);
    const amt = Number(t.amount);
    if (t.direction === 'DEBIT') g.debit += amt; else g.credit += amt;
  }
  const rows = [...map.values()].sort((a,b)=>a.number.localeCompare(b.number));
  let totalD=0,totalC=0; rows.forEach(r=>{ totalD+=r.debit; totalC+=r.credit; });
  const csvLines = [ 'Compte;Libellé;Débit;Crédit;Solde(D-C)' ];
  for (const r of rows) csvLines.push(`${r.number};"${(r.label||'').replace(/"/g,'""')}";${r.debit.toFixed(2)};${r.credit.toFixed(2)};${(r.debit-r.credit).toFixed(2)}`);
  csvLines.push(`TOTAL;;${totalD.toFixed(2)};${totalC.toFixed(2)};${(totalD-totalC).toFixed(2)}`);
  const file = `trial_balance_${new Date().toISOString().slice(0,10)}.csv`;
  writeFileSync(file, csvLines.join('\n'), 'utf8');
  console.log(`Trial balance exporté: ${file}`);
}

main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
