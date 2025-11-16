import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const [totalClients, totalInvoices, invoicedAgg, totalTransactions, totalSuppliers, totalIncomingInvoices, incomingAgg] = await Promise.all([
      prisma.client.count(),
      prisma.invoice.count(),
      prisma.invoice.aggregate({ _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ _sum: { amount: true } }),
      prisma.supplier.count(),
      prisma.incomingInvoice.count(),
      prisma.incomingInvoice.aggregate({ _sum: { totalAmount: true } })
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
