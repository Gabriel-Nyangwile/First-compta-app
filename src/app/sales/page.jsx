import React from "react";
import dynamic from "next/dynamic";
import ChartFacturesVentes from "@/components/ChartFacturesVentes.jsx";
import BackButton from "@/components/BackButton.jsx";
import Link from "next/link";
import prisma from "@/lib/prisma";

export default async function SalesPage() {
  // Récupère tous les clients et factures
  const clients = await prisma.client.findMany();
  const invoices = await prisma.invoice.findMany({
    include: {
      client: true
    }
  });

  // Calculs synthétiques
  const clientCount = clients.length;
  const invoiceCount = invoices.length;
  const invoiceTotal = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
  const overdueCount = invoices.filter(inv => inv.status === "PENDING" && inv.dueDate && new Date(inv.dueDate) < new Date()).length;

  // Graphique synthétique (données simulées)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });
  const dailyTotals = days.map(d => ({
    date: d,
    value: invoiceTotal + Math.floor(Math.random() * 1000 - 500)
  }));

  return (
    <main className="u-main-container u-padding-content-container space-y-8">
      <div className="flex items-center gap-4">
        <BackButton className="text-xs px-3 py-1 rounded bg-slate-100 border text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold mb-2">Ventes</h1>
          <p className="text-sm text-slate-600">Vue synthétique des clients et factures de vente.</p>
        </div>
      </div>
      {/* Bloc résumé ventes */}
      <section className="bg-teal-50 border border-teal-200 rounded p-4 mb-4 flex flex-wrap gap-6 items-center">
        <div className="text-lg font-semibold text-teal-900">Clients : <span className="font-bold">{clientCount}</span></div>
        <div className="text-sm text-teal-700">Factures : <span className="font-bold">{invoiceCount}</span></div>
        <div className="text-sm text-teal-700">Total facturé : <span className="font-bold">{invoiceTotal.toLocaleString()}</span> €</div>
        <div className="text-sm text-teal-700">Factures en retard : <span className="font-bold">{overdueCount}</span></div>
      </section>
      {/* Graphique synthétique factures Chart.js */}
      <section className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Évolution du total facturé (30 jours)</h2>
        <div className="w-full h-40">
          <ChartFacturesVentes data={dailyTotals} />
        </div>
      </section>
      {/* Tableau factures de vente */}
      <section className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Factures de vente</h2>
        <table className="w-full text-xs border">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-2 py-1">Numéro</th>
              <th className="px-2 py-1">Client</th>
              <th className="px-2 py-1">Date</th>
              <th className="px-2 py-1">Statut</th>
              <th className="px-2 py-1">Montant</th>
              <th className="px-2 py-1">Échéance</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-2">Aucune facture de vente</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="bg-slate-50 hover:bg-slate-100">
                <td className="px-2 py-1 font-mono">{inv.invoiceNumber}</td>
                <td className="px-2 py-1">{inv.client?.name ?? "-"}</td>
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
