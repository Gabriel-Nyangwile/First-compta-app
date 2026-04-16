#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async ()=>{
  try{
    const a = await p.account.findFirst({ where: { number: '101100' } });
    console.log('found101100:', !!a);
    const sample = await p.account.findMany({ take: 20 });
    console.log(sample.map(s => `${s.number} ${s.label}`).join('\n'));
  }catch(e){ console.error(e); }
  finally{ await p.$disconnect(); }
})();
