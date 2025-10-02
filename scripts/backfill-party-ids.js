#!/usr/bin/env node
/**
 * Backfill script: populate missing supplierId / clientId on Transaction rows
 * by inferring from related IncomingInvoice / Invoice.
 *
 * Usage:
 *   node scripts/backfill-party-ids.js [--dry-run] [--verbose]
 *
 * Strategy:
 *  - Find transactions with supplierId IS NULL AND incomingInvoiceId NOT NULL.
 *    Join incomingInvoice.supplierId; if present, update in batch.
 *  - Find transactions with clientId IS NULL AND invoiceId NOT NULL.
 *    Join invoice.clientId; if present, update in batch.
 *  - Report counts before/after. Supports dry-run.
 */
import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

function log(...m){ console.log('[backfill-party-ids]', ...m); }

async function main(){
  log('Start', dryRun ? '(dry-run)' : '');

  // Fetch orphan supplier-side transactions
  const supplierOrphans = await prisma.transaction.findMany({
    where: { supplierId: null, incomingInvoiceId: { not: null } },
    select: { id: true, incomingInvoiceId: true, incomingInvoice: { select: { supplierId: true, entryNumber: true } } }
  });
  const clientOrphans = await prisma.transaction.findMany({
    where: { clientId: null, invoiceId: { not: null } },
    select: { id: true, invoiceId: true, invoice: { select: { clientId: true, invoiceNumber: true } } }
  });

  let supplierUpdates = [];
  for (const t of supplierOrphans) {
    const supId = t.incomingInvoice?.supplierId;
    if (supId) supplierUpdates.push({ id: t.id, supplierId: supId });
    else if (verbose) log('Skip supplier orphan (no supplierId on incomingInvoice)', t.id, t.incomingInvoiceId);
  }

  let clientUpdates = [];
  for (const t of clientOrphans) {
    const cliId = t.invoice?.clientId;
    if (cliId) clientUpdates.push({ id: t.id, clientId: cliId });
    else if (verbose) log('Skip client orphan (no clientId on invoice)', t.id, t.invoiceId);
  }

  log('Supplier orphan tx found:', supplierOrphans.length, 'updatable:', supplierUpdates.length);
  log('Client orphan tx found:', clientOrphans.length, 'updatable:', clientUpdates.length);

  if (dryRun) {
    log('Dry-run mode: no updates performed.');
    process.exit(0);
  }

  const BATCH = 200;
  let updatedSupplier = 0;
  for (let i=0;i<supplierUpdates.length;i+=BATCH){
    const slice = supplierUpdates.slice(i,i+BATCH);
    await prisma.$transaction(slice.map(u => prisma.transaction.update({ where: { id: u.id }, data: { supplierId: u.supplierId } })));
    updatedSupplier += slice.length;
  }

  let updatedClient = 0;
  for (let i=0;i<clientUpdates.length;i+=BATCH){
    const slice = clientUpdates.slice(i,i+BATCH);
    await prisma.$transaction(slice.map(u => prisma.transaction.update({ where: { id: u.id }, data: { clientId: u.clientId } })));
    updatedClient += slice.length;
  }

  log('Updated supplier transactions:', updatedSupplier);
  log('Updated client transactions:', updatedClient);
  log('Done.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
