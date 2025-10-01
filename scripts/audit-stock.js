#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, sku: true, name: true } });
  let inconsistencies = 0;
  for (const p of products) {
    const agg = await prisma.stockMovement.groupBy({
      by: ['productId','movementType'],
      where: { productId: p.id },
      _sum: { quantity: true }
    });
    let qtyIn = 0, qtyOut = 0, qtyAdjust = 0;
    for (const g of agg) {
      const q = Number(g._sum.quantity || 0);
      if (g.movementType === 'IN') qtyIn += q; else if (g.movementType === 'OUT') qtyOut += q; else qtyAdjust += q; 
    }
    const theoretical = qtyIn - qtyOut + qtyAdjust; // adjust treated as signed quantity (future)
    const inv = await prisma.productInventory.findUnique({ where: { productId: p.id } });
    const stored = inv ? Number(inv.qtyOnHand) : 0;
    const diff = +(theoretical - stored).toFixed(3);
    if (Math.abs(diff) > 0.0005) {
      inconsistencies++;
      console.log(`⚠️  ${p.sku} ${p.name} diff=${diff} (calc=${theoretical.toFixed(3)} stored=${stored.toFixed(3)})`);
      if (process.argv.includes('--fix')) {
        await prisma.productInventory.upsert({
          where: { productId: p.id },
          update: { qtyOnHand: theoretical.toFixed(3) },
          create: { productId: p.id, qtyOnHand: theoretical.toFixed(3) }
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
