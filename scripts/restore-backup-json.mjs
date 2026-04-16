#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// Set DATABASE_URL before importing PrismaClient
const TEST_DB = process.env.DATABASE_URL_TEST || 'postgresql://postgres:Jesus@localhost:5432/first_compta_restore_test';
process.env.DATABASE_URL = TEST_DB;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(process.cwd(), 'backups', '2025-09-25T16-26-43-481Z');

function readJson(name) {
  const p = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

async function importMany(model, rows) {
  if (!rows || !rows.length) return 0;
  try {
    // createMany with skipDuplicates to avoid unique violations
    const res = await prisma[model].createMany({ data: rows, skipDuplicates: true });
    console.log(`Imported ${res.count} into ${model}`);
    return res.count;
  } catch (err) {
    console.error(`Error importing ${model}:`, err.message);
    // fallback: insert one by one
    let created = 0;
    for (const r of rows) {
      try { await prisma[model].create({ data: r }); created++; } catch (e) { /* ignore */ }
    }
    console.log(`Imported ${created} into ${model} (fallback)`);
    return created;
  }
}

async function main() {
  console.log('Restore script starting. Target DB:', TEST_DB);

  // Load files in a safe order
  const order = [
    'user.json',
    'account.json',
    'moneyAccount.json',
    'client.json',
    'supplier.json',
    'product.json',
    'invoice.json',
    'invoiceLine.json',
    'incomingInvoice.json',
    'incomingInvoiceLine.json',
    'moneyMovement.json',
    'transaction.json',
    'bankAdvice.json',
    'treasuryAuthorization.json'
  ];

  for (const f of order) {
    const rows = readJson(f);
    if (!rows) { console.log(`Skipping missing ${f}`); continue; }

    // Determine model name in prisma client
    const model = path.basename(f, '.json');
    if (!prisma[model]) {
      const alt = model.charAt(0).toUpperCase() + model.slice(1);
      if (prisma[alt]) {
        await importMany(alt, rows);
      } else {
        console.warn(`No Prisma model for ${model}, skipping`);
      }
    } else {
      await importMany(model, rows);
    }
  }

  console.log('Restore finished. Run integrity checks next.');
  await prisma.$disconnect();
}

main().catch(e => { console.error('Fatal restore error:', e); prisma.$disconnect(); process.exit(1); });
