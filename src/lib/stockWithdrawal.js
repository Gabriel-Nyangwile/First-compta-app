import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";

export const STOCK_WITHDRAWAL_TYPES = new Set([
  "PRODUCTION",
  "SALE",
  "SAMPLE",
  "OTHER",
]);

export const STOCK_WITHDRAWAL_STATUSES = new Set([
  "DRAFT",
  "CONFIRMED",
  "POSTED",
  "CANCELLED",
]);

const STATUS_TRANSITIONS = {
  DRAFT: new Set(["CONFIRMED", "CANCELLED"]),
  CONFIRMED: new Set(["POSTED", "CANCELLED"]),
  POSTED: new Set(),
  CANCELLED: new Set(),
};

export function canTransitionStatus(current, next) {
  if (!current || !next) return false;
  const allowed = STATUS_TRANSITIONS[current];
  return Boolean(allowed && allowed.has(next));
}

export async function nextStockWithdrawalNumber(client) {
  const prismaClient = client || prisma;
  return nextSequence(prismaClient, "SW", "SW-");
}

export function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

export function normalizeStockWithdrawal(withdrawal) {
  if (!withdrawal) return null;
  const serializeDate = (date) =>
    date?.toISOString?.() ?? (date instanceof Date ? date.toISOString() : date);

  const normalizedLines = (withdrawal.lines || []).map((line) => {
    const movements = (line.movements || []).map((movement) => ({
      ...movement,
      quantity: toNumber(movement.quantity),
      unitCost: movement.unitCost != null ? toNumber(movement.unitCost) : null,
      totalCost:
        movement.totalCost != null ? toNumber(movement.totalCost) : null,
      date: serializeDate(movement.date),
      createdAt: serializeDate(movement.createdAt),
    }));

    const salesOrderLine = line.salesOrderLine
      ? {
          ...line.salesOrderLine,
          quantityOrdered: toNumber(line.salesOrderLine.quantityOrdered),
          quantityAllocated: toNumber(line.salesOrderLine.quantityAllocated),
          quantityShipped: toNumber(line.salesOrderLine.quantityShipped),
          quantityInvoiced: toNumber(line.salesOrderLine.quantityInvoiced),
          unitPrice: toNumber(line.salesOrderLine.unitPrice),
          lineTotalHt: toNumber(line.salesOrderLine.lineTotalHt),
          lineTotalTtc: toNumber(line.salesOrderLine.lineTotalTtc),
        }
      : null;

    return {
      ...line,
      quantity: toNumber(line.quantity),
      unitCost: line.unitCost != null ? toNumber(line.unitCost) : null,
      totalCost: line.totalCost != null ? toNumber(line.totalCost) : null,
      createdAt: serializeDate(line.createdAt),
      updatedAt: serializeDate(line.updatedAt),
      movements,
      salesOrderLine,
    };
  });

  return {
    ...withdrawal,
    requestedAt: serializeDate(withdrawal.requestedAt),
    confirmedAt: serializeDate(withdrawal.confirmedAt),
    postedAt: serializeDate(withdrawal.postedAt),
    createdAt: serializeDate(withdrawal.createdAt),
    updatedAt: serializeDate(withdrawal.updatedAt),
    lines: normalizedLines,
  };
}
