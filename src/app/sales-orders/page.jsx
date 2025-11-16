import Link from "next/link";
import { absoluteUrl } from "@/lib/url";
import SalesOrderStatusCell from "@/components/salesOrders/SalesOrderStatusCell";

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
}

function formatCurrency(amount) {
  const number = Number(amount || 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

async function fetchSalesOrders(rawSearchParams) {
  const searchParams = await rawSearchParams;
  const qs = new URLSearchParams();
  if (searchParams?.status) qs.set("status", searchParams.status);
  if (searchParams?.q) qs.set("q", searchParams.q);
  if (searchParams?.clientId) qs.set("clientId", searchParams.clientId);
  const remaining = searchParams?.remaining;
  if (remaining === "1" || remaining === "true" || remaining === "yes") {
    qs.set("remaining", "1");
  }

  const path = `/api/sales-orders${qs.toString() ? `?${qs.toString()}` : ""}`;
  const url = await absoluteUrl(path);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage(props) {
  const awaitedSearchParams = await props.searchParams;
  const orders = await fetchSalesOrders(awaitedSearchParams);

  const enriched = orders.map((order) => {
    const remainingQty = (order.lines || []).reduce(
      (sum, line) => sum + Number(line.remainingQuantity || 0),
      0
    );
    const pendingLines = (order.lines || []).filter(
      (line) => Number(line.remainingQuantity || 0) > 1e-6
    ).length;
    return {
      ...order,
      remainingQty,
      pendingLines,
    };
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Commandes clients</h1>
        <Link
          href="/sales-orders/create"
          className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-500"
        >
          Nouvelle commande
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 text-xs bg-gray-50 p-3 rounded border">
        <input
          type="text"
          name="q"
          placeholder="Recherche numéro ou référence client"
          defaultValue={awaitedSearchParams?.q || ""}
          className="border px-2 py-1 rounded"
        />
        <select
          name="status"
          defaultValue={awaitedSearchParams?.status || ""}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous statuts</option>
          {["DRAFT", "CONFIRMED", "FULFILLED"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 border px-2 py-1 rounded bg-white">
          <input
            type="checkbox"
            name="remaining"
            value="1"
            defaultChecked={
              awaitedSearchParams?.remaining === "1" ||
              awaitedSearchParams?.remaining === "true" ||
              awaitedSearchParams?.remaining === "yes"
            }
          />
          Restant à facturer
        </label>
        <button className="px-3 py-1 bg-blue-600 text-white rounded">
          Filtrer
        </button>
        <a href="/sales-orders" className="px-3 py-1 bg-gray-300 rounded">
          Réinitialiser
        </a>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">Numéro</th>
              <th className="border px-2 py-1">Client</th>
              <th className="border px-2 py-1">Statut</th>
              <th className="border px-2 py-1">Émise le</th>
              <th className="border px-2 py-1">Livraison prévue</th>
              <th className="border px-2 py-1 text-right">Total HT</th>
              <th className="border px-2 py-1 text-right">
                Qté restante / lignes
              </th>
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 ? (
              <tr>
                <td
                  className="border px-3 py-6 text-center text-gray-500"
                  colSpan={7}
                >
                  Aucune commande client trouvée.
                </td>
              </tr>
            ) : (
              enriched.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="border px-2 py-1 font-mono text-sm">
                    <Link
                      href={`/sales-orders/${order.id}`}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {order.number}
                    </Link>
                  </td>
                  <td className="border px-2 py-1">
                    {order.client?.name || "—"}
                  </td>
                  <td className="border px-2 py-1">
                    <SalesOrderStatusCell
                      orderId={order.id}
                      initialStatus={order.status}
                    />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {formatDate(order.issueDate)}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {formatDate(order.expectedShipDate)}
                  </td>
                  <td className="border px-2 py-1 text-right font-mono">
                    {formatCurrency(order.totalAmountHt)}
                  </td>
                  <td className="border px-2 py-1 text-right font-mono">
                    {Number(order.remainingQty || 0).toFixed(3)}{" "}
                    {order.pendingLines > 0 ? `(${order.pendingLines})` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
