
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
import ChartDashboardPersonnel from "../../components/ChartDashboardPersonnel";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [stockHistory, setStockHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionsCondensed, setSectionsCondensed] = useState({
    accounting: false,
    stock: false,
    lettrage: false,
    treasury: false,
    purchases: false,
    sales: false,
    personnel: false,
  });
  const toggleSection = (key) => setSectionsCondensed(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    async function fetchStats() {
      try {
        const [stock, alerts, lettrage, treasury, sales, purchases, summary, personnel, personnelTrend] = await Promise.all([
          fetch("/api/stock-ledger?all=1").then(r => r.ok ? r.json() : {}),
          fetch("/api/stock-alerts").then(r => r.ok ? r.json() : []),
          fetch("/api/lettrage/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/treasury/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/sales/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/purchases/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/dashboard-summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/personnel/summary").then(r => r.ok ? r.json() : {}),
          fetch("/api/personnel/trend?months=6").then(r => r.ok ? r.json() : { months: [] }),
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
        setStats({ stock, alerts, lettrage, treasury, sales: salesKPIs, purchases: purchasesKPIs, summary, personnel, personnelTrend });
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
      <h1 className="text-3xl font-bold mb-4">Dashboard Synthétique</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          ['accounting','Comptabilité'],
          ['stock','Stock'],
          ['lettrage','Lettrage'],
            ['treasury','Trésorerie'],
          ['purchases','Achats'],
          ['sales','Ventes'],
          ['personnel','Personnel'],
        ].map(([key,label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleSection(key)}
            className={`text-xs px-2 py-1 rounded border ${sectionsCondensed[key] ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
          >{label}: {sectionsCondensed[key] ? 'Condensé' : 'Étendu'}</button>
        ))}
      </div>
      {loading && <div>Chargement...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Carte Statistiques Comptables + badge factures en retard */}
          <div className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-gray-900">Comptabilité</div>
            {!sectionsCondensed.accounting && <>
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
            </>}
            {sectionsCondensed.accounting && <div className="text-sm text-gray-700 flex flex-wrap gap-3">
              <span>Total facturé: <span className="font-bold">{stats.summary?.invoices?.totalAmount?.toLocaleString() ?? '-'}</span> €</span>
              <span>Factures reçues: <span className="font-bold">{stats.summary?.incomingInvoices?.totalAmount?.toLocaleString() ?? '-'}</span> €</span>
              <span>Transac: <span className="font-bold">{stats.summary?.transactions?.totalAmount?.toLocaleString() ?? '-'}</span> €</span>
            </div>}
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
                    height: sectionsCondensed.stock ? 80 : 120,
                  }}
                  height={sectionsCondensed.stock ? 80 : 120}
                />
              </div>
            )}
            {!sectionsCondensed.stock && <div className="flex gap-2 mt-2">
              <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs">{stats.alerts?.filter(a => a.alert).length} alertes stock</span>
              <Link href="/stock-ledger" className="text-blue-700 underline text-xs">Voir détail</Link>
            </div>}
          </div>
          {/* Carte Lettrage remaniée avec nouveaux champs summary */}
          <div className="bg-green-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-green-900">Lettrage</div>
            {!sectionsCondensed.lettrage && <>
              <div className="text-sm text-green-600">Lettrés : <span className="font-bold">{stats.lettrage?.matched ?? 0}</span></div>
              <div className="text-sm text-green-600">Non lettrés : <span className="font-bold">{stats.lettrage?.unmatched ?? 0}</span></div>
              <div className="text-sm text-green-600">Total : <span className="font-bold">{stats.lettrage?.total ?? 0}</span></div>
            </>}
            <div className="text-sm text-green-600 flex items-center gap-2">
              Taux de lettrage : <span className="font-bold">{stats.lettrage?.rate ?? 0}%</span>
              {!sectionsCondensed.lettrage && stats.lettrage?.rate < 50 && (
                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold ml-2">ALERTE &lt; 50%</span>
              )}
            </div>
            {!sectionsCondensed.lettrage && <div className="flex gap-2 mt-2">
              <Link href="/lettrage/debug" className="text-green-700 underline text-xs">Voir détail</Link>
            </div>}
          </div>
          {/* Carte Trésorerie enrichie */}
          <div className="bg-purple-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-purple-900">Trésorerie</div>
            <div className={`text-2xl font-bold ${stats.treasury?.balance < 0 ? "text-red-700" : "text-purple-700"}`}>
              {stats.treasury?.balance ?? "-"} €
              {!sectionsCondensed.treasury && stats.treasury?.balance < 0 && (
                <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Solde négatif</span>
              )}
            </div>
            {!sectionsCondensed.treasury && <>
              <div className="text-sm text-purple-600">Comptes: <span className="font-bold">{stats.treasury?.accounts ?? '-'}</span></div>
              <div className="text-sm text-purple-600">Solde max: <span className="font-bold">{stats.treasury?.max?.toLocaleString() ?? '-'}</span> €</div>
              <div className="text-sm text-purple-600">Solde min: <span className="font-bold">{stats.treasury?.min?.toLocaleString() ?? '-'}</span> €</div>
              <div className="text-sm text-purple-600">Mouvements récents: {stats.treasury?.recentCount ?? 0}</div>
              <Link href="/treasury" className="text-purple-700 underline text-xs mt-2">Voir détail</Link>
            </>}
          </div>
          {/* Carte Achats enrichie */}
          <div className="bg-orange-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-orange-900">Achats</div>
            {!sectionsCondensed.purchases && <>
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
            </>}
            {sectionsCondensed.purchases && <div className="text-sm text-orange-700 flex flex-wrap gap-3">
              <span>Commandes: <span className="font-bold">{stats.purchases?.total?.toLocaleString() ?? '-'}</span> €</span>
              <span>Fact. reçues: <span className="font-bold">{stats.purchases?.invoiceTotal?.toLocaleString() ?? '-'}</span> €</span>
            </div>}
          </div>
          {/* Carte Ventes enrichie */}
          <div className="bg-teal-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-teal-900">Ventes</div>
            {!sectionsCondensed.sales && <>
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
            </>}
            {sectionsCondensed.sales && <div className="text-sm text-teal-700 flex flex-wrap gap-3">
              <span>Facturé: <span className="font-bold">{stats.sales?.total?.toLocaleString() ?? '-'}</span> €</span>
              <span>Clients: <span className="font-bold">{stats.sales?.clientCount ?? '-'}</span></span>
            </div>}
          </div>
          {/* Widget graphique synthétique ventes Chart.js */}
          <div className="bg-white rounded shadow p-4 flex flex-col gap-2">
            <div className="text-lg font-semibold text-gray-900">Évolution ventes (6 mois)</div>
            <div className={sectionsCondensed.sales ? 'h-24' : 'h-32'}>
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
            <div className={sectionsCondensed.purchases ? 'h-24' : 'h-32'}>
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
            <div className={sectionsCondensed.treasury ? 'h-24' : 'h-32'}>
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
          {/* Carte Personnel (Effectif & Rémunération) */}
          <div className="bg-indigo-50 rounded shadow p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold text-indigo-900">Personnel</div>
              <button
                type="button"
                onClick={() => toggleSection('personnel')}
                className="text-[11px] px-2 py-1 rounded border border-indigo-300 bg-white hover:bg-indigo-100 text-indigo-700"
              >{sectionsCondensed.personnel ? 'Étendu' : 'Condensé'}</button>
            </div>
            <div className="text-sm text-indigo-700">Effectif total : <span className="font-bold">{stats.personnel?.headcount?.total ?? '-'}</span></div>
            <div className="text-sm text-indigo-700">Actifs : <span className="font-bold">{stats.personnel?.headcount?.active ?? '-'}</span></div>
            {!sectionsCondensed.personnel && (
              <div className="text-sm text-indigo-700 flex flex-wrap gap-2">
                <span className="bg-indigo-200 text-indigo-900 px-2 py-1 rounded text-xs">Embauches Mois: {stats.personnel?.headcount?.hiresMonth ?? 0}</span>
                <span className="bg-purple-200 text-purple-900 px-2 py-1 rounded text-xs">Sorties Mois: {stats.personnel?.headcount?.exitsMonth ?? 0}</span>
                <span className="bg-indigo-200 text-indigo-900 px-2 py-1 rounded text-xs">Embauches YTD: {stats.personnel?.headcount?.hiresYtd ?? 0}</span>
                <span className="bg-purple-200 text-purple-900 px-2 py-1 rounded text-xs">Sorties YTD: {stats.personnel?.headcount?.exitsYtd ?? 0}</span>
              </div>
            )}
            <div className={"text-xs text-indigo-600 mt-1 flex flex-col gap-1 " + (sectionsCondensed.personnel ? 'space-y-0.5' : '')}>
              <div>Statuts: A:{stats.personnel?.headcount?.status?.ACTIVE ?? 0} / In:{stats.personnel?.headcount?.status?.INACTIVE ?? 0} / S:{stats.personnel?.headcount?.status?.SUSPENDED ?? 0} / Ex:{stats.personnel?.headcount?.status?.EXITED ?? 0}</div>
              {!sectionsCondensed.personnel && <div>Contrats: CDI {stats.personnel?.contracts?.totals?.CDI ?? 0} ({stats.personnel?.contracts?.percentages?.CDI ?? 0}%) • CDD {stats.personnel?.contracts?.totals?.CDD ?? 0} ({stats.personnel?.contracts?.percentages?.CDD ?? 0}%) • CI {stats.personnel?.contracts?.totals?.CI ?? 0} ({stats.personnel?.contracts?.percentages?.CI ?? 0}%) • N/A {stats.personnel?.contracts?.totals?.UNKNOWN ?? 0} ({stats.personnel?.contracts?.percentages?.UNKNOWN ?? 0}%)</div>}
              {!sectionsCondensed.personnel && <div>Tenure moy: {stats.personnel?.tenure?.averageMonths ?? 0} mois (n={stats.personnel?.tenure?.activeSample ?? 0})</div>}
              {!sectionsCondensed.personnel && <div className="text-[11px] text-indigo-500">Tenure dist: &lt;6m {stats.personnel?.tenure?.buckets?.['<6m'] ?? 0} • 6-12m {stats.personnel?.tenure?.buckets?.['6-12m'] ?? 0} • 1-2y {stats.personnel?.tenure?.buckets?.['1-2y'] ?? 0} • 2-5y {stats.personnel?.tenure?.buckets?.['2-5y'] ?? 0} • 5y+ {stats.personnel?.tenure?.buckets?.['5y+'] ?? 0}</div>}
              {!sectionsCondensed.personnel && <div>Âge moy: {stats.personnel?.age?.averageYears ?? 0} ans (médiane {stats.personnel?.age?.medianYears ?? 0})</div>}
              {!sectionsCondensed.personnel && <div className="text-[11px] text-indigo-500">Âge dist: &lt;25 {stats.personnel?.age?.buckets?.['<25'] ?? 0} • 25-34 {stats.personnel?.age?.buckets?.['25-34'] ?? 0} • 35-44 {stats.personnel?.age?.buckets?.['35-44'] ?? 0} • 45-54 {stats.personnel?.age?.buckets?.['45-54'] ?? 0} • 55+ {stats.personnel?.age?.buckets?.['55+'] ?? 0}</div>}
              <div>Turnover Mois: {stats.personnel?.headcount?.turnoverMonth ?? 0}% • Turnover YTD: {stats.personnel?.headcount?.turnoverYtd ?? 0}%</div>
              {stats.personnelTrend?.months?.length > 0 && (()=>{ const last=stats.personnelTrend.months[stats.personnelTrend.months.length-1]; return (
                <div className="flex gap-2 mt-1">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[11px] font-medium">Hire rate { (last.hiresRatePct ?? 0).toFixed(2) }%</span>
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[11px] font-medium">Exit turnover { (last.exitTurnoverPct ?? 0).toFixed(2) }%</span>
                </div>
              );})()}
            </div>
            {!sectionsCondensed.personnel && (
              <div className="mt-2 text-sm text-indigo-700">
                <div className="font-semibold">Rémunération</div>
                <div>Mois (Brut / Net moy): {stats.personnel?.compensation?.month?.avgGross?.toLocaleString?.() ?? 0} € / {stats.personnel?.compensation?.month?.avgNet?.toLocaleString?.() ?? 0} €</div>
                <div>YTD (Brut / Net moy): {stats.personnel?.compensation?.ytd?.avgGross?.toLocaleString?.() ?? 0} € / {stats.personnel?.compensation?.ytd?.avgNet?.toLocaleString?.() ?? 0} €</div>
              </div>
            )}
            {stats.personnelTrend?.months?.length > 0 && (
              <div className={"mt-3 " + (sectionsCondensed.personnel ? 'h-24' : 'h-32')}>
                <ChartDashboardPersonnel data={stats.personnelTrend.months} height={sectionsCondensed.personnel?90:120} />
              </div>
            )}
            {stats.personnelTrend?.months?.length > 0 && !sectionsCondensed.personnel && (
              <div className="mt-2 border border-indigo-200 rounded overflow-hidden">
                <table className="text-[11px] w-full">
                  <thead className="bg-indigo-100/70">
                    <tr className="text-indigo-700">
                      <th className="py-1 px-2 text-left font-medium">Mois</th>
                      <th className="py-1 px-2 text-right font-medium">Hire%</th>
                      <th className="py-1 px-2 text-right font-medium">Exit%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.personnelTrend.months.map((m,i) => {
                      const isLast = i === stats.personnelTrend.months.length -1;
                      return (
                        <tr key={m.year+'-'+m.month} className={"" + (isLast ? 'bg-indigo-200/50 font-semibold' : (i%2===0 ? 'bg-white' : 'bg-indigo-50/40'))}>
                          <td className="py-0.5 px-2">{String(m.month).padStart(2,'0')}/{String(m.year).slice(-2)}</td>
                          <td className="py-0.5 px-2 text-right">{(m.hiresRatePct ?? 0).toFixed(2)}%</td>
                          <td className="py-0.5 px-2 text-right">{(m.exitTurnoverPct ?? 0).toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
