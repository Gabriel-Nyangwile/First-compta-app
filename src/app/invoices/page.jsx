// app/invoices/page.js

"use client";
// import { fetchClientsAndInvoices, updateInvoiceStatus } from "@/lib/serverActions/clientAndInvoice"; // Import de la nouvelle action
import Link from "next/link"; 
import { useEffect, useState } from "react";
import Amount from '@/components/Amount';
import { useRouter } from "next/navigation";
// ...existing code...
import InvoiceTotals from '@/components/InvoiceTotals';
import { Suspense } from "react";
import InvoiceListItem from '@/components/InvoiceListItem';
import SearchFilterControls from '@/components/SearchFilterControls';
import ClientList from '@/components/ClientList';

export default function InvoicesPage({ searchParams }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pageMeta, setPageMeta] = useState({ page: 1, pageSize: 20, totalCount: 0 });
  const [filters, setFilters] = useState({
    query: '',
    status: 'ALL',
    clientId: 'ALL',
    dateField: 'issueDate',
    startDate: '',
    endDate: '',
    payment: 'ALL'
  });

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/auth/signin");
    } else {
      setUser(JSON.parse(stored));
      // Exemple de chargement des données via API REST
      const url = new URL('/api/invoices', window.location.origin);
      if (filters.payment && filters.payment !== 'ALL') url.searchParams.set('payment', filters.payment.toLowerCase());
      url.searchParams.set('page', String(pageMeta.page));
      url.searchParams.set('pageSize', String(pageMeta.pageSize));
      fetch(url.toString())
        .then(res => res.json())
        .then(data => {
          setInvoices(data.invoices || []);
          setClients(data.clients || []);
          if (data.page) setPageMeta(m => ({ ...m, page: data.page, pageSize: data.pageSize, totalCount: data.totalCount }));
        });
    }
  }, [router, filters.payment, pageMeta.page, pageMeta.pageSize]);

  // Les calculs de totaux peuvent être adaptés à partir des invoices
  const totalPaidAmount = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);
  const totalPendingAmount = invoices.filter(i => i.status === 'PENDING').reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);
  const totalOverdueAmount = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);


  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Factures & Clients
          </h1>
          <div className="space-x-4 flex items-center">
            <div className="flex items-center gap-2 text-xs bg-gray-100 px-3 py-2 rounded">
              <label className="text-gray-600">Paiement:</label>
              <select value={filters.payment} onChange={e=> setFilters(f=> ({...f, payment: e.target.value}))} className="border rounded px-2 py-1 bg-white">
                <option value="ALL">Tous</option>
                <option value="UNPAID">Non payés</option>
                <option value="PARTIAL">Partiels</option>
                <option value="PAID">Payés</option>
              </select>
              <a href="/api/invoices/export" className="text-indigo-600 underline">Export CSV</a>
              <select value={pageMeta.pageSize} onChange={e=> setPageMeta(m=> ({...m, pageSize: Number(e.target.value), page: 1 }))} className="border rounded px-2 py-1 bg-white">
                {[10,20,50,100].map(sz=> <option key={sz} value={sz}>{sz}/p</option>)}
              </select>
            </div>
            <Link
              href="/clients/create"
              className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150 ease-in-out"
            >
              Ajouter un client
            </Link>
            <Link
              href="/invoices/create"
              className="px-2 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-150 ease-in-out"
            >
              Créer une facture
            </Link>
          </div>
        </div>
        {/* Aperçu des totaux par statut */}
        <InvoiceTotals
          totalPaid={totalPaidAmount}
          totalPending={totalPendingAmount}
          totalOverdue={totalOverdueAmount}
        />
        {/* NOUVEAU : Composant de recherche et filtres */}
        <Suspense fallback={<div>Chargement des filtres...</div>}>
          <SearchFilterControls initialFilters={filters} clients={clients} />
        </Suspense>
        {/* FIN NOUVEAU */}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Section des factures */}
          <div className="border border-gray-200 p-6 rounded-lg bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Factures ({invoices.length})
            </h2>
            <div className="text-xs text-slate-600 mb-2 flex flex-wrap gap-4">
              <span>Total payé affiché: <Amount value={invoices.reduce((s,i)=> s + Number(i.paidAmount||0),0)} /></span>
              <span>Total restant: <Amount value={invoices.reduce((s,i)=> s + Number(i.outstandingAmount|| (Number(i.totalAmount||0) - Number(i.paidAmount||0))),0)} /></span>
            </div>
            <ul className="space-y-3">
              {invoices.length === 0 ? (
                <p className="text-gray-500 italic">Aucune facture trouvée.</p>
              ) : (
                invoices.map((invoice) => (
                  //--- NOUVEAU : Utiliser le composant InvoiceListItem pour chaque item de liste --- 
                  <InvoiceListItem key={invoice.id} invoice={invoice} />
                ))
              )}
            </ul>
            <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
              <div>
                Page {pageMeta.page} / {Math.max(1, Math.ceil(pageMeta.totalCount / pageMeta.pageSize))} ({pageMeta.totalCount} factures)
              </div>
              <div className="flex items-center gap-2">
                <button disabled={pageMeta.page<=1} onClick={()=> setPageMeta(m=> ({...m, page: Math.max(1, m.page-1)}))} className="px-2 py-1 border rounded disabled:opacity-40">Précédent</button>
                <button disabled={pageMeta.page >= Math.ceil(pageMeta.totalCount / pageMeta.pageSize)} onClick={()=> setPageMeta(m=> ({...m, page: m.page+1}))} className="px-2 py-1 border rounded disabled:opacity-40">Suivant</button>
              </div>
            </div>
          </div>

          {/* Liste des clients */}
          <div className="border border-gray-200 p-6 rounded-lg bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Clients ({clients.length})
            </h2>
            <ClientList clients={clients} />
          </div>
        </div>
      </div>
    </main>
  );
}
