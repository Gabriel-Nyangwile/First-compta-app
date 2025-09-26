#!/usr/bin/env node
/**
 * Audit script: recompute paid/outstanding for invoices & incoming invoices and compare with stored values.
 * Exits with code 1 if discrepancies found unless --no-exit-error is passed.
 * Usage: node scripts/audit-invoice-balances.js [--fix] [--no-exit-error]
 */
import prisma from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

const args = process.argv.slice(2);
const doFix = args.includes('--fix');
const noExitError = args.includes('--no-exit-error');

async function auditInvoices() {
  const rows = await prisma.invoice.findMany({ select: { id:true, invoiceNumber:true, totalAmount:true, paidAmount:true, outstandingAmount:true, status:true } });
  const diffs = [];
  for (const inv of rows) {
    const paidAgg = await prisma.moneyMovement.aggregate({ where: { invoiceId: inv.id, direction: 'IN' }, _sum: { amount: true } });
    const paid = paidAgg._sum.amount || new Prisma.Decimal(0);
    const outstanding = inv.totalAmount.minus(paid);
    let status;
    if (paid.gte(inv.totalAmount)) status='PAID'; else if (paid.gt(0)) status='PARTIAL'; else status='PENDING';
    if (!paid.eq(inv.paidAmount) || !outstanding.eq(inv.outstandingAmount) || status !== inv.status) {
      diffs.push({ type:'INVOICE', id:inv.id, number:inv.invoiceNumber, stored:{paid:inv.paidAmount.toString(), outstanding:inv.outstandingAmount.toString(), status:inv.status}, recomputed:{paid:paid.toString(), outstanding:outstanding.toString(), status} });
      if (doFix) {
        await prisma.invoice.update({ where:{ id:inv.id }, data:{ paidAmount:paid, outstandingAmount:outstanding, status } });
      }
    }
  }
  return diffs;
}

async function auditIncoming() {
  const rows = await prisma.incomingInvoice.findMany({ select: { id:true, entryNumber:true, totalAmount:true, paidAmount:true, outstandingAmount:true, status:true } });
  const diffs = [];
  for (const inv of rows) {
    const paidAgg = await prisma.moneyMovement.aggregate({ where: { incomingInvoiceId: inv.id, direction: 'OUT' }, _sum: { amount: true } });
    const paid = paidAgg._sum.amount || new Prisma.Decimal(0);
    const outstanding = inv.totalAmount.minus(paid);
    let status;
    if (paid.gte(inv.totalAmount)) status='PAID'; else if (paid.gt(0)) status='PARTIAL'; else status='PENDING';
    if (!paid.eq(inv.paidAmount) || !outstanding.eq(inv.outstandingAmount) || status !== inv.status) {
      diffs.push({ type:'INCOMING', id:inv.id, number:inv.entryNumber, stored:{paid:inv.paidAmount.toString(), outstanding:inv.outstandingAmount.toString(), status:inv.status}, recomputed:{paid:paid.toString(), outstanding:outstanding.toString(), status} });
      if (doFix) {
        await prisma.incomingInvoice.update({ where:{ id:inv.id }, data:{ paidAmount:paid, outstandingAmount:outstanding, status } });
      }
    }
  }
  return diffs;
}

(async () => {
  try {
    const diffs1 = await auditInvoices();
    const diffs2 = await auditIncoming();
    const all = [...diffs1, ...diffs2];
    if (!all.length) {
      console.log('Audit OK: no discrepancies.');
    } else {
      console.log('Discrepancies found:', JSON.stringify(all,null,2));
      if (doFix) console.log('All discrepancies fixed.');
      if (!noExitError && !doFix) process.exit(1);
    }
  } catch(e) {
    console.error('Audit failed', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
