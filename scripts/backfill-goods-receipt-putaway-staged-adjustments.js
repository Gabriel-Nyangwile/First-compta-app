#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const EPSILON = 0.0005;

async function main() {
  const lines = await prisma.goodsReceiptLine.findMany({
    where: {
      qtyPutAway: { gt: 0 },
    },
    select: {
      id: true,
      companyId: true,
      productId: true,
      qtyReceived: true,
      qtyPutAway: true,
      unitCost: true,
      goodsReceipt: {
        select: {
          receiptDate: true,
          number: true,
        },
      },
      product: {
        select: {
          sku: true,
          name: true,
        },
      },
      stockMovements: {
        select: {
          id: true,
          movementType: true,
          stage: true,
          quantity: true,
        },
      },
    },
  });

  let fixes = 0;
  for (const line of lines) {
    const stagedNet = line.stockMovements
      .filter((movement) => movement.stage === 'STAGED')
      .reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
    const expectedStaged = Math.max(
      0,
      Number(line.qtyReceived || 0) - Number(line.qtyPutAway || 0)
    );
    const missingQty = +(stagedNet - expectedStaged).toFixed(3);

    if (missingQty <= EPSILON) continue;

    fixes++;
    console.log(
      `[MISSING] ${line.goodsReceipt?.number || line.id} ${line.product?.sku || line.productId} missing staged adjustment=${missingQty.toFixed(3)} expectedStaged=${expectedStaged.toFixed(3)} currentStaged=${stagedNet.toFixed(3)}`
    );

    if (!APPLY) continue;

    const unitCost = Number(line.unitCost || 0);
    await prisma.stockMovement.create({
      data: {
        companyId: line.companyId || null,
        productId: line.productId,
        movementType: 'ADJUST',
        stage: 'STAGED',
        quantity: (-missingQty).toFixed(3),
        unitCost: unitCost.toFixed(4),
        totalCost: (-(missingQty * unitCost)).toFixed(2),
        goodsReceiptLineId: line.id,
      },
    });
  }

  if (!fixes) {
    console.log('Aucun ajustement STAGED manquant.');
  } else if (APPLY) {
    console.log(`Ajustements créés: ${fixes}`);
  } else {
    console.log(`Ajustements manquants détectés: ${fixes} (relancer avec --apply)`);
  }
}

main()
  .catch((error) => {
    console.error('Backfill put-away staged adjustments error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });