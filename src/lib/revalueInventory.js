import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function revalueProducts({ productIds = null, strict = false } = {}) {
  const where = productIds && productIds.length ? { id: { in: productIds } } : {};
  const products = await prisma.product.findMany({ where, select: { id: true, sku: true, name: true } });
  const results = [];
  for (const p of products) {
    const movements = await prisma.stockMovement.findMany({
      where: { productId: p.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
    });
    let qty = 0; // numeric
    let avg = null; // numeric
    const changes = [];
    let warnings = [];
    for (const m of movements) {
      const q = Number(m.quantity);
      switch (m.movementType) {
        case 'IN': {
          const inCost = m.unitCost != null ? Number(m.unitCost) : 0;
          const prevTotal = avg != null ? qty * avg : 0;
            const newQty = qty + q;
            const newAvg = newQty > 0 ? (prevTotal + q * inCost) / newQty : 0;
            qty = newQty; avg = newQty > 0 ? newAvg : null;
            const desiredUnitCost = inCost; // keep as provided
            const desiredTotalCost = m.totalCost != null ? Number(m.totalCost) : q * desiredUnitCost;
            if (Number(m.unitCost ?? NaN) !== desiredUnitCost || Number(m.totalCost ?? NaN) !== desiredTotalCost) {
              changes.push({ id: m.id, unitCost: desiredUnitCost, totalCost: desiredTotalCost });
            }
          break; }
        case 'ADJUST': {
          // Positive -> like IN; Negative -> like OUT at avg
          if (q >= 0) {
            const adjCost = m.unitCost != null ? Number(m.unitCost) : (avg ?? 0);
            const prevTotal = avg != null ? qty * avg : 0;
            const newQty = qty + q;
            const newAvg = newQty > 0 ? (prevTotal + q * adjCost) / newQty : adjCost;
            qty = newQty; avg = newQty > 0 ? newAvg : null;
            const desiredUnitCost = adjCost;
            const desiredTotalCost = q * adjCost;
            if (Number(m.unitCost ?? NaN) !== desiredUnitCost || Number(m.totalCost ?? NaN) !== desiredTotalCost) {
              changes.push({ id: m.id, unitCost: desiredUnitCost, totalCost: desiredTotalCost });
            }
          } else {
            const outQty = Math.abs(q);
            if (outQty > qty && strict) throw new Error(`Stock négatif sur ajustement pour ${p.sku}`);
            if (outQty > qty) warnings.push('Ajustement négatif provoque stock négatif (toléré)');
            const unitCost = avg ?? 0;
            qty = qty - outQty;
            if (qty <= 0) { qty = 0; avg = null; }
            const desiredTotalCost = -outQty * unitCost;
            if (Number(m.unitCost ?? NaN) !== unitCost || Number(m.totalCost ?? NaN) !== desiredTotalCost) {
              changes.push({ id: m.id, unitCost, totalCost: desiredTotalCost });
            }
          }
          break; }
        case 'OUT': {
          if (q > qty && strict) throw new Error(`Stock insuffisant (OUT) pour ${p.sku}`);
          if (q > qty) warnings.push('Sortie provoque stock négatif (toléré)');
          const unitCost = avg ?? 0;
          qty = qty - q;
          if (qty <= 0) { qty = 0; avg = null; }
          const desiredUnitCost = unitCost;
          const desiredTotalCost = q * unitCost;
          if (Number(m.unitCost ?? NaN) !== desiredUnitCost || Number(m.totalCost ?? NaN) !== desiredTotalCost) {
            changes.push({ id: m.id, unitCost: desiredUnitCost, totalCost: desiredTotalCost });
          }
          break; }
        default:
          warnings.push(`Type mouvement inconnu ${m.movementType}`);
      }
    }
    // Apply changes sequentially
    for (const c of changes) {
      await prisma.stockMovement.update({ where: { id: c.id }, data: { unitCost: c.unitCost.toFixed(4), totalCost: c.totalCost.toFixed(2) } });
    }
    await prisma.productInventory.upsert({
      where: { productId: p.id },
      update: { qtyOnHand: qty.toFixed(3), avgCost: avg != null ? avg.toFixed(4) : null },
      create: { productId: p.id, qtyOnHand: qty.toFixed(3), avgCost: avg != null ? avg.toFixed(4) : null }
    });
    results.push({ productId: p.id, sku: p.sku, name: p.name, qtyOnHand: qty, avgCost: avg, updatedMovements: changes.length, warnings });
  }
  return results;
}

// Allow script execution
if (process.argv[1] && process.argv[1].includes('revalueInventory')) {
  (async () => {
    const res = await revalueProducts();
    console.table(res.map(r => ({ sku: r.sku, qty: r.qtyOnHand, avg: r.avgCost, updates: r.updatedMovements })));
    process.exit(0);
  })();
}
