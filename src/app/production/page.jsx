import Link from "next/link";
import { internalApiFetch } from "@/lib/url";

function countByStatus(orders) {
  return orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
}

async function fetchProduction() {
  const [ordersRes, bomsRes] = await Promise.all([
    internalApiFetch("/api/production/orders", { cache: "no-store" }),
    internalApiFetch("/api/production/boms", { cache: "no-store" }),
  ]);
  const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] };
  const bomsData = bomsRes.ok ? await bomsRes.json() : { boms: [] };
  return { orders: ordersData.orders || [], boms: bomsData.boms || [] };
}

export const dynamic = "force-dynamic";

export default async function ProductionOverviewPage() {
  const { orders, boms } = await fetchProduction();
  const counts = countByStatus(orders);
  const producedQty = orders.reduce((sum, order) => sum + Number(order.producedQty || 0), 0);
  const activeBoms = boms.filter((bom) => bom.status === "ACTIVE").length;
  const recentOrders = orders.slice(0, 6);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Production</h1>
          <p className="text-sm text-slate-600">Fabrication simple à partir du stock existant.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/production/boms/create" className="rounded border border-emerald-300 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
            Nouvelle nomenclature
          </Link>
          <Link href="/production/orders/create" className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">
            Nouvel ordre
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-slate-500">Nomenclatures actives</div>
          <div className="mt-1 text-2xl font-semibold">{activeBoms}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-slate-500">Ordres à lancer</div>
          <div className="mt-1 text-2xl font-semibold">{counts.DRAFT || 0}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-slate-500">En cours</div>
          <div className="mt-1 text-2xl font-semibold">{(counts.RELEASED || 0) + (counts.IN_PROGRESS || 0)}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs text-slate-500">Quantité produite</div>
          <div className="mt-1 text-2xl font-semibold">{producedQty.toFixed(3)}</div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ordres récents</h2>
          <Link href="/production/orders" className="text-sm text-blue-600 underline">Voir tous</Link>
        </div>
        {!recentOrders.length ? (
          <div className="rounded border border-dashed bg-white p-6 text-sm text-slate-600">
            Aucun ordre de fabrication. Créez d'abord une nomenclature active, puis un ordre.
          </div>
        ) : (
          <table className="min-w-full border bg-white text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border px-3 py-2 text-left">Ordre</th>
                <th className="border px-3 py-2 text-left">Produit fini</th>
                <th className="border px-3 py-2">Statut</th>
                <th className="border px-3 py-2 text-right">Prévu</th>
                <th className="border px-3 py-2 text-right">Produit</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="border px-3 py-2 font-mono">
                    <Link href={`/production/orders/${order.id}`} className="text-blue-600 underline">{order.number}</Link>
                  </td>
                  <td className="border px-3 py-2">{order.product?.name || "-"}</td>
                  <td className="border px-3 py-2 text-center">{order.status}</td>
                  <td className="border px-3 py-2 text-right">{Number(order.plannedQty).toFixed(3)}</td>
                  <td className="border px-3 py-2 text-right">{Number(order.producedQty).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
