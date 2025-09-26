// app/dashboard/page.js

import prisma from '../../lib/prisma';

function StatCard({ title, value, accent='blue' }) {
  const color = accent === 'indigo' ? 'text-indigo-600' : accent === 'emerald' ? 'text-emerald-600' : accent === 'rose' ? 'text-rose-600' : 'text-[#0070f3]';
  return (
    <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm">
      <h2 className="text-sm font-medium text-gray-600 tracking-wide uppercase">{title}</h2>
      <p className={`mt-2 text-4xl font-bold text-right ${color}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  // On interroge directement Prisma dans le composant serveur (plus simple et évite fetch URL relative côté RSC)
  const [totalClients, totalInvoices, invoicedAgg, totalTransactions, totalSuppliers, totalIncomingInvoices, incomingAgg] = await Promise.all([
    prisma.client.count(),
    prisma.invoice.count(),
    prisma.invoice.aggregate({ _sum: { totalAmount: true } }),
    prisma.transaction.aggregate({ _sum: { amount: true } }),
    prisma.supplier.count(),
    prisma.incomingInvoice.count(),
    prisma.incomingInvoice.aggregate({ _sum: { totalAmount: true } })
  ]);
  const data = {
    clients: { count: totalClients },
    invoices: { count: totalInvoices, totalAmount: Number(invoicedAgg._sum.totalAmount || 0) },
    transactions: { totalAmount: Number(totalTransactions._sum.amount || 0) },
    suppliers: { count: totalSuppliers },
    incomingInvoices: { count: totalIncomingInvoices, totalAmount: Number(incomingAgg._sum.totalAmount || 0) }
  };
  const fmt = (n) => typeof n === 'number' ? n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  return (
  <main className="px-6 max-w-[1000px] mx-auto">
      <h1 className="text-center font-bold text-4xl">Tableau de Bord</h1>
      <p className="text-center text-gray-600 mb-6">Aperçu rapide de la situation comptable (clients & fournisseurs)</p>
      <div className="text-center mb-12">
        <a href="/vat-recap" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded shadow">Voir le récap TVA</a>
      </div>
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Ventes (Clients)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard title="Clients" value={data.clients.count} />
          <StatCard title="Factures clients" value={data.invoices.count} />
          <StatCard title="Total facturé" value={fmt(Number(data.invoices.totalAmount||0)) + ' €'} accent="emerald" />
        </div>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Achats (Fournisseurs)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard title="Fournisseurs" value={data.suppliers.count} accent="indigo" />
          <StatCard title="Factures reçues" value={data.incomingInvoices.count} accent="indigo" />
          <StatCard title="Total factures reçues" value={fmt(Number(data.incomingInvoices.totalAmount||0)) + ' €'} accent="rose" />
        </div>
      </section>
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Transactions Globales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard title="Total des transactions (toutes natures)" value={fmt(Number(data.transactions.totalAmount||0)) + ' €'} />
        </div>
      </section>
    </main>
  );
}
