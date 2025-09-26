#!/usr/bin/env node
/**
 * Simple JSON backup of current business data.
 * Creates a timestamped directory under ./backups and writes one JSON file per entity.
 * Intended for development snapshotting prior to destructive operations.
 */
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

const ENTITIES = [
  'user','account','moneyAccount','client','supplier','invoice','invoiceLine','incomingInvoice',
  'incomingInvoiceLine','transaction','moneyMovement','treasuryAuthorization','bankAdvice'
];

async function dumpEntity(name, dir) {
  const data = await prisma[name].findMany();
  const file = path.join(dir, `${name}.json`);
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return { name, count: data.length };
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const dir = path.join(process.cwd(), 'backups', stamp);
  await fs.promises.mkdir(dir, { recursive: true });
  console.log(`Creating backup in ${dir}`);
  const results = [];
  for (const e of ENTITIES) {
    try {
      results.push(await dumpEntity(e, dir));
      console.log(` - ${e} OK`);
    } catch (err) {
      console.warn(` - ${e} FAILED:`, err.message);
    }
  }
  const summary = { createdAt: new Date().toISOString(), results };
  await fs.promises.writeFile(path.join(dir,'_summary.json'), JSON.stringify(summary,null,2));
  console.log('\nBackup summary:');
  results.forEach(r => console.log(` * ${r.name}: ${r.count}`));
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
