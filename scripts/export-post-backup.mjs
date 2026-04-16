#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Change this to the backup cutoff (ISO string)
const BACKUP_CUTOFF = process.env.BACKUP_CUTOFF || '2025-09-25T00:00:00.000Z';

const outDir = path.resolve(process.cwd(), 'backups', `export-before-restore-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const models = [
  'asset', 'assetDisposal', 'assetPurchaseOrder',
  'payslip', 'payslipLine', 'payrollPeriod', 'payrollVariable',
  'capitalSubscription', 'capitalPayment',
  'invoice', 'invoiceLine', 'incomingInvoice', 'incomingInvoiceLine',
  'moneyMovement', 'payment', 'paymentInvoiceLink',
  'goodsReceipt', 'goodsReceiptLine', 'stockMovement',
  'transaction', 'journalEntry', 'account', 'product', 'productInventory',
  'employee'
];

async function exportModel(modelName) {
  const file = path.join(outDir, `${modelName}.json`);
  try {
    // attempt to find if model has createdAt field by querying one row's keys
    const any = await prisma[modelName].findFirst({});
    let where = {};
    if (any && Object.prototype.hasOwnProperty.call(any, 'createdAt')) {
      where = { where: { createdAt: { gt: new Date(BACKUP_CUTOFF) } } };
    } else {
      // fallback: export everything for models without createdAt
      where = {};
    }

    const rows = await prisma[modelName].findMany(where);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    console.log(`Exported ${rows.length} rows for ${modelName} -> ${file}`);
    return { modelName, count: rows.length };
  } catch (err) {
    console.warn(`Skipping ${modelName}:`, err.message);
    fs.writeFileSync(file, JSON.stringify({ error: err.message }, null, 2));
    return { modelName, count: 0, error: err.message };
  }
}

async function main() {
  console.log('Exporting post-backup records since', BACKUP_CUTOFF);
  const results = [];
  for (const m of models) {
    try {
      // prisma client property names are camelCase; adjust if necessary
      const prop = m;
      if (typeof prisma[prop] !== 'function' && typeof prisma[prop] === 'undefined') {
        // try capitalized
        const alt = m.charAt(0).toUpperCase() + m.slice(1);
        if (prisma[alt]) {
          results.push(await exportModel(alt));
        } else {
          console.warn(`Model ${m} not present in Prisma client`);
        }
      } else {
        results.push(await exportModel(prop));
      }
    } catch (err) {
      console.error(`Error exporting model ${m}:`, err.message);
    }
  }
  console.log('Export complete. Files in', outDir);
  console.table(results.map(r => ({ model: r.modelName, count: r.count || 0, error: r.error || '' })));
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal', e);
  prisma.$disconnect();
  process.exit(1);
});
