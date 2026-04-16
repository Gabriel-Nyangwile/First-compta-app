#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, sku: true, name: true } });
  let inconsistencies = 0;
  for (const p of products) {
    const agg = await prisma.stockMovement.groupBy({
      by: ['productId', 'movementType', 'stage'],
      where: { productId: p.id },
      _sum: { quantity: true }
    });
    let availableIn = 0, availableOut = 0, availableAdjust = 0;
    let stagedIn = 0, stagedOut = 0, stagedAdjust = 0;
    for (const g of agg) {
      const q = Number(g._sum.quantity || 0);
      const isStaged = g.stage === 'STAGED';
      if (g.movementType === 'IN') {
        if (isStaged) stagedIn += q;
        else availableIn += q;
      } else if (g.movementType === 'OUT') {
        if (isStaged) stagedOut += q;
        else availableOut += q;
      } else {
        if (isStaged) stagedAdjust += q;
        else availableAdjust += q;
      }
    }
    const theoreticalOnHand = availableIn - availableOut + availableAdjust;
    const theoreticalStaged = stagedIn - stagedOut + stagedAdjust;
    const inv = await prisma.productInventory.findUnique({ where: { productId: p.id } });
    const storedOnHand = inv ? Number(inv.qtyOnHand) : 0;
    const storedStaged = inv ? Number(inv.qtyStaged || 0) : 0;
    const diffOnHand = +(theoreticalOnHand - storedOnHand).toFixed(3);
    const diffStaged = +(theoreticalStaged - storedStaged).toFixed(3);
    if (Math.abs(diffOnHand) > 0.0005 || Math.abs(diffStaged) > 0.0005) {
      inconsistencies++;
      console.log(`⚠️  ${p.sku} ${p.name} onHandDiff=${diffOnHand} stagedDiff=${diffStaged} (calcOnHand=${theoreticalOnHand.toFixed(3)} storedOnHand=${storedOnHand.toFixed(3)} calcStaged=${theoreticalStaged.toFixed(3)} storedStaged=${storedStaged.toFixed(3)})`);
      if (process.argv.includes('--fix')) {
        await prisma.productInventory.upsert({
          where: { productId: p.id },
          update: {
            qtyOnHand: theoreticalOnHand.toFixed(3),
            qtyStaged: theoreticalStaged.toFixed(3),
          },
          create: {
            productId: p.id,
            qtyOnHand: theoreticalOnHand.toFixed(3),
            qtyStaged: theoreticalStaged.toFixed(3),
          }
        });
        console.log('   → Fix applied');
      }
    }
  }
  if (!inconsistencies) console.log('✅ Aucune divergence stock.');
  else console.log(`Terminé. Divergences: ${inconsistencies}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
