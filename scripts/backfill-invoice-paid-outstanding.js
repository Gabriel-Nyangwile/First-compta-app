#!/usr/bin/env node
/**
 * Backfill script: computes paidAmount and outstandingAmount for existing Invoice and IncomingInvoice rows
 * based on linked MoneyMovement records (direction IN for Invoice, OUT for IncomingInvoice), and updates status.
 *
 * Usage: node scripts/backfill-invoice-paid-outstanding.js [--dry-run]
 */
import prisma from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

async function backfillInvoices() {
  const invoices = await prisma.invoice.findMany({ select: { id: true, totalAmount: true, status: true } });
  let updated = 0;
  for (const inv of invoices) {
    const paidAgg = await prisma.moneyMovement.aggregate({ where: { invoiceId: inv.id, direction: 'IN' }, _sum: { amount: true } });
    const paid = paidAgg._sum.amount || new Prisma.Decimal(0);
    const outstanding = inv.totalAmount.minus(paid);
    let newStatus;
    if (paid.gte(inv.totalAmount)) newStatus = 'PAID';
    else if (paid.gt(0)) newStatus = 'PARTIAL';
    else newStatus = 'PENDING';
    if (!dryRun) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { paidAmount: paid, outstandingAmount: outstanding, status: newStatus } });
    }
    updated++;
  }
  return updated;
}

async function backfillIncomingInvoices() {
  const incoming = await prisma.incomingInvoice.findMany({ select: { id: true, totalAmount: true, status: true } });
  let updated = 0;
  for (const inv of incoming) {
    const paidAgg = await prisma.moneyMovement.aggregate({ where: { incomingInvoiceId: inv.id, direction: 'OUT' }, _sum: { amount: true } });
    const paid = paidAgg._sum.amount || new Prisma.Decimal(0);
    const outstanding = inv.totalAmount.minus(paid);
    let newStatus;
    if (paid.gte(inv.totalAmount)) newStatus = 'PAID';
    else if (paid.gt(0)) newStatus = 'PARTIAL';
    else newStatus = 'PENDING';
    if (!dryRun) {
      await prisma.incomingInvoice.update({ where: { id: inv.id }, data: { paidAmount: paid, outstandingAmount: outstanding, status: newStatus } });
    }
    updated++;
  }
  return updated;
}

(async () => {
  try {
    console.log('Backfill started' + (dryRun ? ' (dry-run)' : ''));
    const c1 = await backfillInvoices();
    const c2 = await backfillIncomingInvoices();
    console.log(`Backfill complete. Invoices processed: ${c1}, Incoming invoices processed: ${c2}`);
  } catch (e) {
    console.error('Backfill error', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
