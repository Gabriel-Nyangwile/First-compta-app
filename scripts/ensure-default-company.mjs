#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main(){
  const id = process.env.DEFAULT_COMPANY_ID || 'default-company';
  try{
    const exists = await prisma.company.findUnique({ where: { id } });
    if (exists) { console.log('Company exists', id); return; }
    await prisma.company.create({ data: { id, name: 'Test Restore Company', currency: 'XOF' } });
    console.log('Created company', id);
  }catch(e){ console.error('Error', e.message); process.exit(1); }
  finally{ await prisma.$disconnect(); }
}
main();
