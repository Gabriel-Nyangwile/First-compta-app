import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const [totalClients, totalInvoices, invoicedAgg, totalTransactions, totalSuppliers, totalIncomingInvoices, incomingAgg] = await Promise.all([
      prisma.client.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId } }),
      prisma.invoice.aggregate({ where: { companyId }, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { companyId }, _sum: { amount: true } }),
      prisma.supplier.count({ where: { companyId } }),
      prisma.incomingInvoice.count({ where: { companyId } }),
      prisma.incomingInvoice.aggregate({ where: { companyId }, _sum: { totalAmount: true } })
    ]);

    return NextResponse.json({
      clients: { count: totalClients },
      invoices: { count: totalInvoices, totalAmount: Number(invoicedAgg._sum.totalAmount || 0) },
      transactions: { totalAmount: Number(totalTransactions._sum.amount || 0) },
      suppliers: { count: totalSuppliers },
      incomingInvoices: { count: totalIncomingInvoices, totalAmount: Number(incomingAgg._sum.totalAmount || 0) }
    });
  } catch (e) {
    console.error("GET /api/dashboard-summary error", e);
    return NextResponse.json({ error: "Erreur récupération dashboard." }, { status: 500 });
  }
}
