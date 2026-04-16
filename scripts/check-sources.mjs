#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  try {
    const invoiceCount = await p.invoice.count();
    const incomingCount = await p.incomingInvoice.count();
    const moneyCount = await p.moneyMovement.count();
    const goodsReceiptCount = await p.goodsReceipt.count();
    console.log('invoice:', invoiceCount);
    console.log('incomingInvoice:', incomingCount);
    console.log('moneyMovement:', moneyCount);
    console.log('goodsReceipt:', goodsReceiptCount);
    const jeCount = await p.journalEntry.count();
    console.log('journalEntry:', jeCount);
    const txCount = await p.transaction.count();
    console.log('transaction:', txCount);
  } catch (e) {
    console.error('Error', e.message);
  } finally {
    await p.$disconnect();
    process.exit(0);
  }
})();
