import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

function toNumber(val) {
  return val?.toNumber?.() ?? 0;
}

export async function GET() {
  // Ventes = Client + Invoice
  const clientCount = await prisma.client.count();
  const invoiceCount = await prisma.invoice.count();
  const invoiceTotal = await prisma.invoice.aggregate({ _sum: { totalAmount: true } });
  // Statut en retard
  const overdueInvoices = await prisma.invoice.count({ where: { status: "PENDING", dueDate: { lt: new Date() } } });
  return Response.json({
    clients: {
      count: clientCount
    },
    invoices: {
      count: invoiceCount,
      totalAmount: toNumber(invoiceTotal._sum.totalAmount),
      overdue: overdueInvoices
    }
  });
}
