import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { requireCompanyId } from "@/lib/tenant";

function toNumber(val) {
  return val?.toNumber?.() ?? 0;
}

/* export async function GET() {
  // Achats = PurchaseOrder + IncomingInvoice
  const poCount = await prisma.purchaseOrder.count();
  const poTotal = await prisma.purchaseOrder.aggregate({ _sum: { totalAmount: true } });
  const invoiceCount = await prisma.incomingInvoice.count();
  const invoiceTotal = await prisma.incomingInvoice.aggregate({ _sum: { totalAmount: true } });
  // Statut en retard
  const overdueInvoices = await prisma.incomingInvoice.count({ where: { status: "PENDING", dueDate: { lt: new Date() } } });
  return Response.json({
    purchaseOrders: {
      count: poCount,
      totalAmount: toNumber(poTotal._sum.totalAmount)
    },
    incomingInvoices: {
      count: invoiceCount,
      totalAmount: toNumber(invoiceTotal._sum.totalAmount),
      overdue: overdueInvoices
    }
  });
} */

export async function GET(request) {
  const companyId = requireCompanyId(request);
  const poCount = await prisma.purchaseOrder.count({ where: { companyId } });
  // Récupère toutes les lignes de commande
  const poLines = await prisma.purchaseOrderLine.findMany({
    where: { companyId },
    select: { unitPrice: true, orderedQty: true }
  });
  // Calcule le total des achats
  const poTotal = poLines.reduce((sum, line) =>
    sum + (Number(line.unitPrice) * Number(line.orderedQty)), 0);

  const invoiceCount = await prisma.incomingInvoice.count({ where: { companyId } });
  const invoiceTotalArr = await prisma.incomingInvoice.findMany({ where: { companyId }, select: { totalAmount: true } });
  const invoiceTotal = invoiceTotalArr.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);

  const overdueInvoices = await prisma.incomingInvoice.count({
    where: { companyId, status: "PENDING", dueDate: { lt: new Date() } }
  });

  return Response.json({
    purchaseOrders: {
      count: poCount,
      totalAmount: poTotal
    },
    incomingInvoices: {
      count: invoiceCount,
      totalAmount: invoiceTotal,
      overdue: overdueInvoices
    }
  });
}
