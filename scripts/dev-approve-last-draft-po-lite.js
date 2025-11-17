#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

(async () => {
  try {
    const po = await prisma.purchaseOrder.findFirst({ where: { status: 'DRAFT' }, orderBy: { createdAt: 'desc' }, select: { id: true, number: true, status: true } });
    if (!po) {
      console.log('No DRAFT PO found');
      process.exit(0);
    }
    console.log('Attempt approving', po.number, po.id, po.status);
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'APPROVED' } });
      await tx.purchaseOrderStatusLog.create({ data: { purchaseOrderId: po.id, oldStatus: po.status, newStatus: 'APPROVED', note: 'Approbation (lite)' } });
      return next;
    });
    console.log('Approved ->', updated.status);
  } catch (e) {
    console.error('Direct approve lite error:', e?.name, e?.message);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
