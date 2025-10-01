#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Inventory flow test ---');
  // 1. Create product
  const product = await prisma.product.create({ data: { sku: 'TINV-' + Date.now(), name: 'Test Inv Item' } });
  console.log('Product created', product.sku);

  // 2. Simulate goods receipt (IN) via direct API logic mimic
  const po = await prisma.purchaseOrder.create({ data: { number: 'PO-TINV-' + Date.now(), supplierId: (await seedSupplier()).id, status: 'APPROVED' } });
  const pol = await prisma.purchaseOrderLine.create({ data: { purchaseOrderId: po.id, productId: product.id, orderedQty: '10', unitPrice: '5', receivedQty: '0' } });
  const gr = await prisma.goodsReceipt.create({ data: { number: 'GR-TINV-' + Date.now(), purchaseOrderId: po.id } });
  const grl = await prisma.goodsReceiptLine.create({ data: { goodsReceiptId: gr.id, productId: product.id, qtyReceived: '10', unitCost: '5', purchaseOrderLineId: pol.id } });
  await prisma.stockMovement.create({ data: { productId: product.id, movementType: 'IN', quantity: '10', unitCost: '5', totalCost: '50', goodsReceiptLineId: grl.id } });
  await prisma.productInventory.upsert({ where: { productId: product.id }, update: { qtyOnHand: '10', avgCost: '5' }, create: { productId: product.id, qtyOnHand: '10', avgCost: '5' } });
  console.log('Received 10 units at 5');

  // 3. Simulate OUT: reduce 4 units at avg cost 5
  await prisma.stockMovement.create({ data: { productId: product.id, movementType: 'OUT', quantity: '4', unitCost: '5', totalCost: '20' } });
  await prisma.productInventory.update({ where: { productId: product.id }, data: { qtyOnHand: '6' } });
  console.log('Sold 4 units');

  // 4. Audit
  const inv = await prisma.productInventory.findUnique({ where: { productId: product.id } });
  if (Number(inv.qtyOnHand) !== 6) throw new Error('Inventory qty mismatch expected 6 got ' + inv.qtyOnHand);
  console.log('Inventory flow test OK');
}

async function seedSupplier() {
  let sup = await prisma.supplier.findFirst();
  if (!sup) {
    sup = await prisma.supplier.create({ data: { name: 'Test Supplier ' + Date.now() } });
  }
  return sup;
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
