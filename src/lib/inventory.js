import prisma from '@/lib/prisma';

// Fetch current inventory aggregate (or create with zero)
export async function getOrCreateInventory(productId) {
  let inv = await prisma.productInventory.findUnique({ where: { productId } });
  if (!inv) {
    inv = await prisma.productInventory.create({ data: { productId, qtyOnHand: '0' } });
  }
  return inv;
}

// Apply an IN movement to update CUMP (weighted average)
export async function applyInMovement(tx, { productId, qty, unitCost }) {
  // qty, unitCost are Numbers already validated
  const current = await tx.productInventory.upsert({
    where: { productId },
    update: {},
    create: { productId, qtyOnHand: '0', avgCost: null }
  });
  const prevQty = Number(current.qtyOnHand);
  const prevAvg = current.avgCost != null ? Number(current.avgCost) : null;
  const incomingQty = qty;
  const incomingCost = unitCost;
  let newAvg;
  if (prevQty <= 0 || prevAvg == null) {
    newAvg = incomingCost; // first batch
  } else {
    const totalPrevCost = prevQty * prevAvg;
    const totalIncomingCost = incomingQty * incomingCost;
    newAvg = (totalPrevCost + totalIncomingCost) / (prevQty + incomingQty);
  }
  const updated = await tx.productInventory.update({
    where: { productId },
    data: {
      qtyOnHand: (prevQty + incomingQty).toFixed(3),
      avgCost: newAvg.toFixed(4)
    }
  });
  return updated;
}

// Apply an OUT movement: consume at current avg cost -> returns cost info
export async function applyOutMovement(tx, { productId, qty }) {
  const inv = await tx.productInventory.upsert({
    where: { productId },
    update: {},
    create: { productId, qtyOnHand: '0', avgCost: null }
  });
  const prevQty = Number(inv.qtyOnHand);
  const avg = inv.avgCost != null ? Number(inv.avgCost) : 0;
  if (qty > prevQty + 1e-9) {
    // Allow negative? For now disallow.
    throw new Error('Stock insuffisant pour sortie.');
  }
  const remaining = (prevQty - qty).toFixed(3);
  const updated = await tx.productInventory.update({
    where: { productId },
    data: { qtyOnHand: remaining }
  });
  return { unitCost: avg, totalCost: avg * qty, inventory: updated };
}

// Adjustment movement (can be positive or negative). For positive we require unitCost (if no prior avg) to update avg; if prior avg exists and unitCost omitted we use prior avg. For negative we reuse avg and validate stock.
export async function applyAdjustMovement(tx, { productId, qty, unitCost }) {
  if (qty === 0) return { unitCost: 0, totalCost: 0 };
  if (qty > 0 && (unitCost == null || isNaN(unitCost))) {
    // unitCost mandatory if no previous avg
    const invPre = await tx.productInventory.findUnique({ where: { productId } });
    if (!invPre || invPre.avgCost == null) throw new Error('unitCost requis pour un ajustement positif initial.');
  }
  if (qty > 0) {
    // treat as IN using provided unitCost or current avg
    const inv = await tx.productInventory.upsert({
      where: { productId },
      update: {},
      create: { productId, qtyOnHand: '0', avgCost: null }
    });
    const cost = unitCost != null ? Number(unitCost) : (inv.avgCost != null ? Number(inv.avgCost) : 0);
    const prevQty = Number(inv.qtyOnHand);
    const prevAvg = inv.avgCost != null ? Number(inv.avgCost) : null;
    let newAvg;
    if (prevQty <= 0 || prevAvg == null) newAvg = cost; else newAvg = ((prevQty * prevAvg) + (qty * cost)) / (prevQty + qty);
    await tx.productInventory.update({
      where: { productId },
      data: { qtyOnHand: (prevQty + qty).toFixed(3), avgCost: newAvg.toFixed(4) }
    });
    return { unitCost: cost, totalCost: cost * qty };
  } else { // negative
    const out = await applyOutMovement(tx, { productId, qty: Math.abs(qty) });
    // applyOutMovement already decreased qtyOnHand.
    return { unitCost: out.unitCost, totalCost: out.totalCost * -1 };
  }
}
