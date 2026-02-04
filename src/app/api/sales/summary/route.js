import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { requireCompanyId } from "@/lib/tenant";

function toNumber(val) {
  return val?.toNumber?.() ?? 0;
}

export async function GET(request) {
  const companyId = requireCompanyId(request);
  // Ventes = Client + Invoice
  const clientCount = await prisma.client.count({ where: { companyId } });
  const invoiceCount = await prisma.invoice.count({ where: { companyId } });
  const invoiceTotal = await prisma.invoice.aggregate({ where: { companyId }, _sum: { totalAmount: true } });
  // Statut en retard
  const overdueInvoices = await prisma.invoice.count({ where: { companyId, status: "PENDING", dueDate: { lt: new Date() } } });
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
