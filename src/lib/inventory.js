import prisma from "@/lib/prisma";

async function ensureInventory(txOrClient, productId, companyId = null) {
  const client = txOrClient || prisma;
  const inv = await client.productInventory.upsert({
    where: { productId },
    update: {},
    create: {
      productId,
      companyId: companyId || null,
      qtyOnHand: "0",
      qtyStaged: "0",
      avgCost: null,
    },
  });
  return inv;
}

export async function getOrCreateInventory(productId, companyId = null) {
  return ensureInventory(prisma, productId, companyId);
}

function toFixed(value, digits = 3) {
  return Number(value).toFixed(digits);
}

export async function applyInMovement(
  tx,
  { productId, qty, unitCost, stage = "AVAILABLE", companyId = null }
) {
  if (!qty || Number.isNaN(qty)) throw new Error("qty invalide");
  if (unitCost == null || Number.isNaN(unitCost))
    throw new Error("unitCost invalide");
  const inv = await ensureInventory(tx, productId, companyId);
  const currentQty = Number(inv.qtyOnHand);
  const currentStaged = Number(inv.qtyStaged || 0);
  const currentAvg = inv.avgCost != null ? Number(inv.avgCost) : null;

  if (stage === "STAGED") {
    const nextStaged = currentStaged + qty;
    if (nextStaged < -1e-9) {
      throw new Error("Quantité staged insuffisante pour correction.");
    }
    const updated = await tx.productInventory.update({
      where: { productId },
      data: { qtyStaged: toFixed(nextStaged) },
    });
    return { inventory: updated, stage: "STAGED" };
  }

  const baseQty = currentQty;
  let newAvg;
  if (baseQty <= 0 || currentAvg == null) {
    newAvg = unitCost;
  } else {
    const totalPrevCost = baseQty * currentAvg;
    const totalIncomingCost = qty * unitCost;
    newAvg = (totalPrevCost + totalIncomingCost) / (baseQty + qty);
  }

  const updated = await tx.productInventory.update({
    where: { productId },
    data: {
      qtyOnHand: toFixed(baseQty + qty),
      avgCost: newAvg != null ? newAvg.toFixed(4) : null,
    },
  });
  return { inventory: updated, stage: "AVAILABLE", avgCost: newAvg };
}

export async function moveStagedToAvailable(
  tx,
  { productId, qty, unitCost, companyId = null }
) {
  if (!qty || Number.isNaN(qty)) throw new Error("qty invalide");
  const inv = await ensureInventory(tx, productId, companyId);
  const staged = Number(inv.qtyStaged || 0);
  if (qty > staged + 1e-9) throw new Error("Quantité staged insuffisante");
  const currentQty = Number(inv.qtyOnHand);
  const currentAvg = inv.avgCost != null ? Number(inv.avgCost) : null;
  const cost =
    unitCost != null && !Number.isNaN(unitCost) ? unitCost : currentAvg ?? 0;
  let newAvg;
  if (currentQty <= 0 || currentAvg == null) {
    newAvg = cost;
  } else {
    const totalPrevCost = currentQty * currentAvg;
    const totalIncomingCost = qty * cost;
    newAvg = (totalPrevCost + totalIncomingCost) / (currentQty + qty);
  }
  const updated = await tx.productInventory.update({
    where: { productId },
    data: {
      qtyOnHand: toFixed(currentQty + qty),
      qtyStaged: toFixed(staged - qty),
      avgCost: newAvg != null ? newAvg.toFixed(4) : null,
    },
  });
  return { inventory: updated, avgCost: newAvg };
}

export async function removeStaged(
  tx,
  { productId, qty, companyId = null }
) {
  const inv = await ensureInventory(tx, productId, companyId);
  const staged = Number(inv.qtyStaged || 0);
  if (qty > staged + 1e-9) throw new Error("Quantité staged insuffisante");
  const updated = await tx.productInventory.update({
    where: { productId },
    data: { qtyStaged: toFixed(staged - qty) },
  });
  return { inventory: updated };
}

export async function applyOutMovement(
  tx,
  { productId, qty, companyId = null }
) {
  if (!qty || Number.isNaN(qty)) throw new Error("qty invalide");
  const inv = await ensureInventory(tx, productId, companyId);
  const prevQty = Number(inv.qtyOnHand);
  const avg = inv.avgCost != null ? Number(inv.avgCost) : 0;
  if (qty > prevQty + 1e-9) {
    throw new Error("Stock insuffisant pour sortie.");
  }
  const updated = await tx.productInventory.update({
    where: { productId },
    data: { qtyOnHand: toFixed(prevQty - qty) },
  });
  return { unitCost: avg, totalCost: avg * qty, inventory: updated };
}

export async function applyAdjustMovement(
  tx,
  { productId, qty, unitCost, companyId = null }
) {
  if (qty === 0) return { unitCost: 0, totalCost: 0 };
  if (qty > 0) {
    const cost = unitCost != null ? Number(unitCost) : 0;
    return applyInMovement(tx, {
      productId,
      qty,
      unitCost: cost,
      stage: "AVAILABLE",
      companyId,
    });
  }
  return applyOutMovement(tx, { productId, qty: Math.abs(qty) });
}
