import Link from "next/link";
import { internalApiFetch } from "@/lib/url";

async function fetchOrders(searchParams) {
  const qs = new URLSearchParams();
  if (searchParams?.status) qs.set("status", searchParams.status);
  if (searchParams?.q) qs.set("q", searchParams.q);
  const res = await internalApiFetch(`/api/production/orders${qs.toString() ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders || [];
}

export const dynamic = "force-dynamic";

export default async function ProductionOrdersPage(props) {
  const searchParams = await props.searchParams;
  const orders = await fetchOrders(searchParams);
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Ordres de fabrication</h1>
        <Link href="/production/orders/create" className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">
          Nouvel ordre
        </Link>
      </div>
      <form className="flex flex-wrap gap-2 rounded border bg-slate-50 p-3 text-sm">
        <input name="q" defaultValue={searchParams?.q || ""} placeholder="Numéro ou produit" className="rounded border px-2 py-1" />
        <select name="status" defaultValue={searchParams?.status || ""} className="rounded border px-2 py-1">
          <option value="">Tous statuts</option>
          {["DRAFT", "RELEASED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <button className="rounded bg-blue-600 px-3 py-1 text-white">Filtrer</button>
        <Link href="/production/orders" className="rounded border px-3 py-1">Réinitialiser</Link>
      </form>
      {!orders.length ? (
        <div className="rounded border border-dashed bg-white p-6 text-sm text-slate-600">Aucun ordre de fabrication.</div>
      ) : (
        <table className="min-w-full border bg-white text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-3 py-2 text-left">Référence</th>
              <th className="border px-3 py-2 text-left">Produit fini</th>
              <th className="border px-3 py-2">Statut</th>
              <th className="border px-3 py-2 text-right">Prévu</th>
              <th className="border px-3 py-2 text-right">Produit</th>
              <th className="border px-3 py-2">Date prévue</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="border px-3 py-2 font-mono">
                  <Link href={`/production/orders/${order.id}`} className="text-blue-600 underline">{order.number}</Link>
                </td>
                <td className="border px-3 py-2">{order.product?.sku} - {order.product?.name}</td>
                <td className="border px-3 py-2 text-center">{order.status}</td>
                <td className="border px-3 py-2 text-right">{Number(order.plannedQty).toFixed(3)}</td>
                <td className="border px-3 py-2 text-right">{Number(order.producedQty).toFixed(3)}</td>
                <td className="border px-3 py-2 text-center">{order.plannedDate ? new Date(order.plannedDate).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
