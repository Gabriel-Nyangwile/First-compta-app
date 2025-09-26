import prisma from '../../../../lib/prisma';

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

    return new Response(JSON.stringify({
      clients: { count: totalClients },
      invoices: { count: totalInvoices, totalAmount: invoicedAgg._sum.totalAmount || 0 },
      transactions: { totalAmount: totalTransactions._sum.amount || 0 },
      suppliers: { count: totalSuppliers },
      incomingInvoices: { count: totalIncomingInvoices, totalAmount: incomingAgg._sum.totalAmount || 0 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Dashboard stats error', e);
    return new Response(JSON.stringify({ error: 'Failed to load dashboard stats' }), { status: 500 });
  }
}
