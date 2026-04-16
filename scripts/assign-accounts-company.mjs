#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async ()=>{
  try{
    const res = await p.account.updateMany({ where: { companyId: null }, data: { companyId: 'default-company' } });
    const c = await p.account.count({ where: { companyId: 'default-company' } });
    console.log('updated count', c, 'matched', res.count);
  }catch(e){ console.error(e); process.exit(1);} finally{ await p.$disconnect(); }
})();
