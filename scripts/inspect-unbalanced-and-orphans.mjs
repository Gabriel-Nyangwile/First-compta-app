#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const txns = await prisma.transaction.findMany({ where: { companyId }, orderBy: { date: 'asc' }, include: { account: true } });
  const byGroup = new Map();
  const orphans = [];
  for(const t of txns){
    const gid = t.groupId || null;
    if(!gid){ orphans.push(t); continue; }
    if(!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid).push(t);
  }

  const unbalanced = [];
  for(const [gid, items] of byGroup.entries()){
    let debit = 0, credit = 0;
    for(const it of items){ if(it.direction === 'DEBIT') debit += toNumber(it.amount); else credit += toNumber(it.amount); }
    const diff = Math.round((debit - credit) * 100) / 100;
    if(Math.abs(diff) > 0.01) unbalanced.push({ groupId: gid, debit, credit, diff, count: items.length, items });
  }

  unbalanced.sort((a,b)=> Math.abs(b.diff) - Math.abs(a.diff));

  console.log(JSON.stringify({ totalTransactions: txns.length, groups: byGroup.size, orphanCount: orphans.length, unbalancedCount: unbalanced.length }, null, 2));

  console.log('\nTop unbalanced groups (up to 15):');
  for(const g of unbalanced.slice(0,15)){
    console.log(JSON.stringify({ groupId: g.groupId, debit: g.debit, credit: g.credit, diff: g.diff, count: g.count }, null, 2));
    console.log(' sampleTransactions:');
    for(const s of g.items.slice(0,10)){
      console.log(JSON.stringify({ id: s.id, date: s.date.toISOString(), amount: toNumber(s.amount), direction: s.direction, accountNumber: s.account?.number || null, kind: s.kind, description: s.description }, null, 2));
    }
    console.log('---');
  }

  console.log('\nSample orphan transactions (up to 20):');
  for(const o of orphans.slice(0,20)){
    console.log(JSON.stringify({ id: o.id, groupId: o.groupId || null, date: o.date.toISOString(), amount: toNumber(o.amount), direction: o.direction, accountNumber: o.account?.number || null, kind: o.kind, description: o.description }, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
