import React from "react";
import ChartFacturesAchats from "@/components/ChartFacturesAchats.jsx";
import BackButton from "@/components/BackButton.jsx";
import Link from "next/link";
import prisma from "@/lib/prisma";


export default async function PurchasesPage(props) {
  // Filtres synthétiques
  const sp = await props?.searchParams || {};
  const supplierId = sp?.supplier || "";
  const dateFrom = sp?.from || "";
  const dateTo = sp?.to || "";
  const q = (sp?.q || "").toLowerCase();

  // Récupère tous les bons de commande et factures fournisseurs
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    include: {
      supplier: true,
      lines: true,
      incomingInvoices: true
    }
  });
  const incomingInvoices = await prisma.incomingInvoice.findMany({
    include: {
      supplier: true
    }
  });

  // Calculs synthétiques
  const poCount = purchaseOrders.length;
  const poTotal = purchaseOrders.reduce((sum, po) => sum + po.lines.reduce((lSum, l) => lSum + Number(l.unitPrice) * Number(l.orderedQty), 0), 0);
  const invoiceCount = incomingInvoices.length;
  const invoiceTotal = incomingInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
  const overdueCount = incomingInvoices.filter(inv => inv.status === "PENDING" && inv.dueDate && new Date(inv.dueDate) < new Date()).length;

  // Graphique synthétique (données simulées)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });
  const dailyTotals = days.map(d => ({
    date: d,
    value: poTotal + Math.floor(Math.random() * 1000 - 500)
  }));

  return (
    <main className="u-main-container u-padding-content-container space-y-8">
      <div className="flex items-center gap-4">
        <BackButton className="text-xs px-3 py-1 rounded bg-slate-100 border text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold mb-2">Achats</h1>
          <p className="text-sm text-slate-600">Vue synthétique des bons de commande et factures fournisseurs.</p>
        </div>
      </div>
      {/* Filtres synthétiques */}
      <form className="flex flex-wrap gap-4 items-end mb-4" method="get">
        <div className="flex flex-col">
          <label className="text-slate-600">Fournisseur</label>
          <select name="supplier" defaultValue={supplierId} className="border px-2 py-1 rounded text-xs">
            <option value="">Tous</option>
            {[...new Set(purchaseOrders.map(po => po.supplier?.id))].filter(Boolean).map(id => {
              const name = purchaseOrders.find(po => po.supplier?.id === id)?.supplier?.name;
              return <option key={id} value={id}>{name}</option>;
            })}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-slate-600">Du</label>
          <input type="date" name="from" defaultValue={dateFrom} className="border px-2 py-1 rounded text-xs" />
        </div>
        <div className="flex flex-col">
          <label className="text-slate-600">Au</label>
          <input type="date" name="to" defaultValue={dateTo} className="border px-2 py-1 rounded text-xs" />
        </div>
        <div className="flex flex-col">
          <label className="text-slate-600">Recherche</label>
          <input type="text" name="q" defaultValue={q} placeholder="Réf / desc / facture" className="border px-2 py-1 rounded text-xs" />
        </div>
        <button className="bg-orange-700 text-white px-3 py-1 rounded text-xs" type="submit">Filtrer</button>
        <a href="/api/purchases/summary/export" className="bg-slate-100 text-orange-700 px-3 py-1 rounded text-xs border ml-2" target="_blank">Export CSV</a>
        <a href="/api/purchases/summary/pdf" className="bg-slate-100 text-orange-700 px-3 py-1 rounded text-xs border" target="_blank">PDF</a>
      </form>
      {/* Bloc résumé achats */}
      <section className="bg-orange-50 border border-orange-200 rounded p-4 mb-4 flex flex-wrap gap-6 items-center">
        <div className="text-lg font-semibold text-orange-900">Bons de commande : <span className="font-bold">{poCount}</span></div>
        <div className="text-sm text-orange-700">Total commandes : <span className="font-bold">{poTotal.toLocaleString()}</span> €</div>
        <div className="text-sm text-orange-700">Factures reçues : <span className="font-bold">{invoiceCount}</span></div>
        <div className="text-sm text-orange-700">Total factures reçues : <span className="font-bold">{invoiceTotal.toLocaleString()}</span> €</div>
        <div className="text-sm text-orange-700">Factures en retard : <span className="font-bold">{overdueCount}</span></div>
      </section>
      {/* Graphique synthétique commandes Chart.js */}
      <section className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Évolution du total commandes (30 jours)</h2>
        <div className="w-full h-40">
          <ChartFacturesAchats data={dailyTotals} />
        </div>
      </section>
      {/* Tableau bons de commande */}
      <section className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Bons de commande</h2>
        <table className="w-full text-xs border">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-1">Numéro</th>
              <th className="px-2 py-1">Fournisseur</th>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Statut</th>
              <th className="px-2 py-1">Montant</th>
              <th className="px-2 py-1">Factures liées</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-2">Aucun bon de commande</td></tr>
            )}
            {purchaseOrders.map(po => (
              <tr key={po.id} className="bg-slate-50 hover:bg-slate-100">
                <td className="px-2 py-1 font-mono">{po.number}</td>
                <td className="px-2 py-1">{po.supplier?.name ?? "-"}</td>
                <td className="px-2 py-1">{new Date(po.issueDate).toLocaleDateString()}</td>
                <td className="px-2 py-1">{po.status}</td>
                <td className="px-2 py-1 font-bold">{po.lines.reduce((sum, l) => sum + Number(l.unitPrice) * Number(l.orderedQty), 0).toLocaleString()} €</td>
                <td className="px-2 py-1">{po.incomingInvoices.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {/* Tableau factures fournisseurs */}
      <section className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Factures fournisseurs</h2>
        <table className="w-full text-xs border">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-1">Numéro</th>
              <th className="px-2 py-1">Fournisseur</th>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Statut</th>
              <th className="px-2 py-1">Montant</th>
              <th className="px-2 py-1">Échéance</th>
            </tr>
          </thead>
          <tbody>
            {incomingInvoices.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-2">Aucune facture fournisseur</td></tr>
            )}
            {incomingInvoices.map(inv => (
              <tr key={inv.id} className="bg-slate-50 hover:bg-slate-100">
                <td className="px-2 py-1 font-mono">{inv.entryNumber}</td>
                <td className="px-2 py-1">{inv.supplier?.name ?? "-"}</td>
                <td className="px-2 py-1">{new Date(inv.issueDate).toLocaleDateString()}</td>
                <td className="px-2 py-1">{inv.status}</td>
                <td className="px-2 py-1 font-bold">{Number(inv.totalAmount ?? 0).toLocaleString()} €</td>
                <td className="px-2 py-1">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
