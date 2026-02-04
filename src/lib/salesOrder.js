import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";

export const SALES_ORDER_STATUSES = new Set(["DRAFT", "CONFIRMED", "FULFILLED"]);

const STATUS_TRANSITIONS = {
  DRAFT: new Set(["CONFIRMED"]),
  CONFIRMED: new Set(["FULFILLED"]),
  FULFILLED: new Set(),
};

export function canTransitionStatus(current, next) {
  if (!current || !next) return false;
  const allowed = STATUS_TRANSITIONS[current];
  return Boolean(allowed && allowed.has(next));
}

export async function nextSalesOrderNumber(client, companyId) {
  const prismaClient = client || prisma;
  return nextSequence(prismaClient, "SO", "SO-", companyId);
}

export function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

function serializeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value?.toISOString?.() ?? value;
}

export function normalizeSalesOrder(order) {
  if (!order) return null;

  const normalizedLines = (order.lines || []).map((line) => {
    const stockWithdrawalLines = (line.stockWithdrawalLines || []).map(
      (swLine) => ({
        ...swLine,
        quantity: toNumber(swLine.quantity),
        unitCost:
          swLine.unitCost != null ? toNumber(swLine.unitCost) : null,
        totalCost:
          swLine.totalCost != null ? toNumber(swLine.totalCost) : null,
        createdAt: serializeDate(swLine.createdAt),
        updatedAt: serializeDate(swLine.updatedAt),
        stockWithdrawal: swLine.stockWithdrawal
          ? {
              ...swLine.stockWithdrawal,
              postedAt: serializeDate(swLine.stockWithdrawal.postedAt),
            }
          : null,
      })
    );

    const invoiceLines = (line.invoiceLines || []).map((invoiceLine) => ({
      ...invoiceLine,
      quantity: toNumber(invoiceLine.quantity),
      unitPrice: toNumber(invoiceLine.unitPrice),
      lineTotal: toNumber(invoiceLine.lineTotal),
      invoice: invoiceLine.invoice
        ? {
            ...invoiceLine.invoice,
            issueDate: serializeDate(invoiceLine.invoice.issueDate),
          }
        : null,
    }));

    return {
      ...line,
      quantityOrdered: toNumber(line.quantityOrdered),
      quantityAllocated: toNumber(line.quantityAllocated),
      quantityShipped: toNumber(line.quantityShipped),
      quantityInvoiced: toNumber(line.quantityInvoiced),
      unitPrice: toNumber(line.unitPrice),
      lineTotalHt: toNumber(line.lineTotalHt),
      lineTotalTtc: toNumber(line.lineTotalTtc),
      createdAt: serializeDate(line.createdAt),
      updatedAt: serializeDate(line.updatedAt),
      stockWithdrawalLines,
      invoiceLines,
    };
  });

  return {
    ...order,
    issueDate: serializeDate(order.issueDate),
    expectedShipDate: serializeDate(order.expectedShipDate),
    confirmedAt: serializeDate(order.confirmedAt),
    fulfilledAt: serializeDate(order.fulfilledAt),
    createdAt: serializeDate(order.createdAt),
    updatedAt: serializeDate(order.updatedAt),
    totalQuantity: toNumber(order.totalQuantity),
    totalAmountHt: toNumber(order.totalAmountHt),
    totalAmountTtc: toNumber(order.totalAmountTtc),
    totalVatAmount: toNumber(order.totalVatAmount),
    lines: normalizedLines,
  };
}

export function computeSalesOrderTotals(lines = []) {
  return lines.reduce(
    (acc, line) => {
      const qty = toNumber(line.quantityOrdered);
      const unitPrice = toNumber(line.unitPrice);
      const vatRate = line.vatRate != null ? toNumber(line.vatRate) : null;
      const lineHt = line.lineTotalHt != null ? toNumber(line.lineTotalHt) : qty * unitPrice;
      const vatAmount = vatRate != null ? lineHt * vatRate : 0;
      const lineTtc = line.lineTotalTtc != null ? toNumber(line.lineTotalTtc) : lineHt + vatAmount;

      acc.totalQuantity += qty;
      acc.totalAmountHt += lineHt;
      acc.totalVatAmount += vatAmount;
      acc.totalAmountTtc += lineTtc;
      return acc;
    },
    {
      totalQuantity: 0,
      totalAmountHt: 0,
      totalVatAmount: 0,
      totalAmountTtc: 0,
    }
  );
}
