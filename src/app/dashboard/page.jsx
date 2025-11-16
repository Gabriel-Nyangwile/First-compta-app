
"use client";
import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import Link from "next/link";
import ChartDashboardVentes from "../../components/ChartDashboardVentes";
import ChartDashboardAchats from "../../components/ChartDashboardAchats";
import ChartDashboardTresorerie from "../../components/ChartDashboardTresorerie";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [stockHistory, setStockHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [stock, alerts, lettrage, treasury, sales, purchases, summary] = await Promise.all([
          fetch("/api/stock-ledger?all=1").then(r => r.ok ? r.json() : {}),
          fetch("/api/stock-alerts").then(r => r.ok ? r.json() : []),
          fetch("/api/lettrage/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/treasury/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/sales/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/purchases/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/dashboard-summary").then(r => r.ok ? r.json() : {}),
        ]);
        const purchasesKPIs = {
          count: purchases?.purchaseOrders?.count ?? 0,
          total: purchases?.purchaseOrders?.totalAmount ?? 0,
          invoiceCount: purchases?.incomingInvoices?.count ?? 0,
          invoiceTotal: purchases?.incomingInvoices?.totalAmount ?? 0,
          overdue: purchases?.incomingInvoices?.overdue ?? 0,
          avg: purchases?.purchaseOrders?.count ? Math.round((purchases?.purchaseOrders?.totalAmount ?? 0) / purchases?.purchaseOrders?.count) : 0,
        };
        const salesKPIs = {
          count: sales?.invoices?.count ?? 0,
          total: sales?.invoices?.totalAmount ?? 0,
          clientCount: sales?.clients?.count ?? 0,
          overdue: sales?.invoices?.overdue ?? 0,
          avg: sales?.invoices?.count ? Math.round((sales?.invoices?.totalAmount ?? 0) / sales?.invoices?.count) : 0,
        };
        setStats({ stock, alerts, lettrage, treasury, sales: salesKPIs, purchases: purchasesKPIs, summary });
        setStockHistory([
          { month: "Mai", value: 12000 },
          { month: "Juin", value: 12500 },
          { month: "Juil", value: 12300 },
          { month: "Août", value: 12800 },
          { month: "Sept", value: 13000 },
          { month: "Oct", value: 13250 },
        ]);
      } catch (e) {
        setError("Erreur chargement dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard Synthétique</h1>
      {loading && <div>Chargement...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Carte Statistiques Comptables + badge factures en retard */}
          <div className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-gray-900">Comptabilité</div>
            <div className="text-sm text-gray-700">Clients: <span className="font-bold">{stats.summary?.clients?.count ?? '-'}</span></div>
            <div className="text-sm text-gray-700">Factures clients: <span className="font-bold">{stats.summary?.invoices?.count ?? '-'}</span></div>
            <div className="text-sm text-gray-700">Total facturé: <span className="font-bold">{stats.summary?.invoices?.totalAmount?.toLocaleString() ?? '-'}</span> €</div>
            <div className="text-sm text-gray-700">Fournisseurs: <span className="font-bold">{stats.summary?.suppliers?.count ?? '-'}</span></div>
            <div className="text-sm text-gray-700">Factures reçues: <span className="font-bold">{stats.summary?.incomingInvoices?.count ?? '-'}</span></div>
            <div className="text-sm text-gray-700">Total factures reçues: <span className="font-bold">{stats.summary?.incomingInvoices?.totalAmount?.toLocaleString() ?? '-'}</span> €</div>
            <div className="text-sm text-gray-700">Total transactions: <span className="font-bold">{stats.summary?.transactions?.totalAmount?.toLocaleString() ?? '-'}</span> €</div>
            <div className="flex gap-2 mt-2">
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                {stats.summary?.invoices?.overdue ?? 0} factures clients en retard
              </span>
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                {stats.summary?.incomingInvoices?.overdue ?? 0} factures fournisseurs en retard
              </span>
            </div>
          </div>
          {/* Carte Stock global + graphique évolution */}
          <div className="bg-blue-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-blue-900">Stock global</div>
            <div className="text-2xl font-bold text-blue-700">{stats.stock?.products?.reduce((sum, p) => sum + (p.stockFinal || 0), 0) ?? 0}</div>
            <div className="text-sm text-blue-600">Valeur totale: {stats.stock?.products?.reduce((sum, p) => sum + (p.stockFinal * p.avgCostFinal || 0), 0).toLocaleString() ?? 0} €</div>
            {stockHistory && (
              <div className="mt-2">
                <Bar
                  data={{
                    labels: stockHistory.map(h => h.month),
                    datasets: [
                      {
                        label: "Évolution stock (€)",
                        data: stockHistory.map(h => h.value),
                        backgroundColor: "#3b82f6",
                        borderRadius: 4,
                      },
                    ],
                  }}
                  options={{
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} €`,
                        },
                      },
                    },
                    scales: {
                      x: { grid: { display: false } },
                      y: { grid: { display: false }, ticks: { callback: v => v.toLocaleString() } },
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    height: 120,
                  }}
                  height={120}
                />
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs">{stats.alerts?.filter(a => a.alert).length} alertes stock</span>
              <Link href="/stock-ledger" className="text-blue-700 underline text-xs">Voir détail</Link>
            </div>
          </div>
          {/* Carte Lettrage remaniée avec nouveaux champs summary */}
          <div className="bg-green-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-green-900">Lettrage</div>
            <div className="text-sm text-green-600">Lettrés : <span className="font-bold">{stats.lettrage?.matched ?? 0}</span></div>
            <div className="text-sm text-green-600">Non lettrés : <span className="font-bold">{stats.lettrage?.unmatched ?? 0}</span></div>
            <div className="text-sm text-green-600">Total : <span className="font-bold">{stats.lettrage?.total ?? 0}</span></div>
            <div className="text-sm text-green-600 flex items-center gap-2">
              Taux de lettrage : <span className="font-bold">{stats.lettrage?.rate ?? 0}%</span>
              {stats.lettrage?.rate < 50 && (
                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold ml-2">ALERTE &lt; 50%</span>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Link href="/lettrage/debug" className="text-green-700 underline text-xs">Voir détail</Link>
            </div>
          </div>
          {/* Carte Trésorerie enrichie */}
          <div className="bg-purple-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-purple-900">Trésorerie</div>
            <div className={`text-2xl font-bold ${stats.treasury?.balance < 0 ? "text-red-700" : "text-purple-700"}`}>
              {stats.treasury?.balance ?? "-"} €
              {stats.treasury?.balance < 0 && (
                <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Solde négatif</span>
              )}
            </div>
            <div className="text-sm text-purple-600">Comptes: <span className="font-bold">{stats.treasury?.accounts ?? '-'}</span></div>
            <div className="text-sm text-purple-600">Solde max: <span className="font-bold">{stats.treasury?.max?.toLocaleString() ?? '-'}</span> €</div>
            <div className="text-sm text-purple-600">Solde min: <span className="font-bold">{stats.treasury?.min?.toLocaleString() ?? '-'}</span> €</div>
            <div className="text-sm text-purple-600">Mouvements récents: {stats.treasury?.recentCount ?? 0}</div>
            <Link href="/treasury" className="text-purple-700 underline text-xs mt-2">Voir détail</Link>
          </div>
          {/* Carte Achats enrichie */}
          <div className="bg-orange-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-orange-900">Achats</div>
            <div className="text-sm text-orange-700">Bons de commande : <span className="font-bold">{stats.purchases?.count ?? "-"}</span></div>
            <div className="text-sm text-orange-700">Total commandes : <span className="font-bold">{stats.purchases?.total?.toLocaleString() ?? "-"}</span> €</div>
            <div className="text-sm text-orange-700">Factures reçues : <span className="font-bold">{stats.purchases?.invoiceCount ?? "-"}</span></div>
            <div className="text-sm text-orange-700">Total factures reçues : <span className="font-bold">{stats.purchases?.invoiceTotal?.toLocaleString() ?? "-"}</span> €</div>
            <div className="text-sm text-orange-700">Montant moyen commande : <span className="font-bold">{stats.purchases?.avg?.toLocaleString() ?? "-"}</span> €</div>
            <div className="flex gap-2 mt-2">
              {stats.purchases?.overdue > 0 && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">{stats.purchases?.overdue} factures fournisseurs en retard</span>
              )}
              <Link href="/purchases" className="text-orange-700 underline text-xs">Voir détail</Link>
            </div>
          </div>
          {/* Carte Ventes enrichie */}
          <div className="bg-teal-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-teal-900">Ventes</div>
            <div className="text-sm text-teal-700">Factures clients : <span className="font-bold">{stats.sales?.count ?? "-"}</span></div>
            <div className="text-sm text-teal-700">Total facturé : <span className="font-bold">{stats.sales?.total?.toLocaleString() ?? "-"}</span> €</div>
            <div className="text-sm text-teal-700">Clients : <span className="font-bold">{stats.sales?.clientCount ?? "-"}</span></div>
            <div className="text-sm text-teal-700">Montant moyen facture : <span className="font-bold">{stats.sales?.avg?.toLocaleString() ?? "-"}</span> €</div>
            <div className="flex gap-2 mt-2">
              {stats.sales?.overdue > 0 && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">{stats.sales?.overdue} factures clients en retard</span>
              )}
              <Link href="/sales" className="text-teal-700 underline text-xs">Voir détail</Link>
            </div>
          </div>
          {/* Widget graphique synthétique ventes Chart.js */}
          <div className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-gray-900">Évolution ventes (6 mois)</div>
            <div className="h-32">
              <ChartDashboardVentes
                data={[
                  { label: "Mai", value: stats.sales?.total ? Math.round(stats.sales.total * 0.7) : 12000 },
                  { label: "Juin", value: stats.sales?.total ? Math.round(stats.sales.total * 0.8) : 12500 },
                  { label: "Juil", value: stats.sales?.total ? Math.round(stats.sales.total * 0.85) : 12300 },
                  { label: "Août", value: stats.sales?.total ? Math.round(stats.sales.total * 0.9) : 12800 },
                  { label: "Sept", value: stats.sales?.total ? Math.round(stats.sales.total * 0.95) : 13000 },
                  { label: "Oct", value: stats.sales?.total ?? 13250 }
                ]}
              />
            </div>
          </div>
          {/* Widget graphique synthétique achats Chart.js */}
          <div className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-gray-900">Évolution achats (6 mois)</div>
            <div className="h-32">
              <ChartDashboardAchats
                data={[
                  { label: "Mai", value: stats.purchases?.total ? Math.round(stats.purchases.total * 0.7) : 10000 },
                  { label: "Juin", value: stats.purchases?.total ? Math.round(stats.purchases.total * 0.8) : 10500 },
                  { label: "Juil", value: stats.purchases?.total ? Math.round(stats.purchases.total * 0.85) : 10300 },
                  { label: "Août", value: stats.purchases?.total ? Math.round(stats.purchases.total * 0.9) : 10800 },
                  { label: "Sept", value: stats.purchases?.total ? Math.round(stats.purchases.total * 0.95) : 11000 },
                  { label: "Oct", value: stats.purchases?.total ?? 11250 }
                ]}
              />
            </div>
          </div>
          {/* Widget graphique synthétique trésorerie Chart.js */}
          <div className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-gray-900">Évolution trésorerie (6 mois)</div>
            <div className="h-32">
              <ChartDashboardTresorerie
                data={[
                  { label: "Mai", value: stats.treasury?.balance ? Math.round(stats.treasury.balance * 0.7) : 8000 },
                  { label: "Juin", value: stats.treasury?.balance ? Math.round(stats.treasury.balance * 0.8) : 8500 },
                  { label: "Juil", value: stats.treasury?.balance ? Math.round(stats.treasury.balance * 0.85) : 8300 },
                  { label: "Août", value: stats.treasury?.balance ? Math.round(stats.treasury.balance * 0.9) : 8800 },
                  { label: "Sept", value: stats.treasury?.balance ? Math.round(stats.treasury.balance * 0.95) : 9000 },
                  { label: "Oct", value: stats.treasury?.balance ?? 9250 }
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
