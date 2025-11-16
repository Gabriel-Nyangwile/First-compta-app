import Link from "next/link";
import { absoluteUrl } from "@/lib/url";
import PurchaseOrderRowActions from "./PurchaseOrderRowActions";

function StatusBadge({ status }) {
  const base =
    "inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide";
  const map = {
    DRAFT: "bg-gray-200 text-gray-700",
    APPROVED: "bg-blue-100 text-blue-700",
    STAGED: "bg-purple-100 text-purple-700",
    PARTIAL: "bg-amber-100 text-amber-700",
    RECEIVED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-300 text-gray-800",
    CANCELLED: "bg-red-100 text-red-700",
  };
  return (
    <span className={base + " " + (map[status] || "bg-gray-100 text-gray-700")}>
      {status}
    </span>
  );
}

async function fetchPOs(rawSearchParams) {
  // Next.js 15+ may supply an async/thenable searchParams; await defensively
  const searchParams = await rawSearchParams;
  const qs = new URLSearchParams();
  if (searchParams?.status) qs.set("status", searchParams.status);
  if (searchParams?.q) qs.set("q", searchParams.q);
  const path = `/api/purchase-orders${
    qs.toString() ? "?" + qs.toString() : ""
  }`;
  const url = await absoluteUrl(path);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchMissingInvoicePos() {
  const url = await absoluteUrl("/api/purchase-orders/missing-invoices");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.purchaseOrders) ? data.purchaseOrders : [];
}

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage(props) {
  const awaitedSearchParams = await props.searchParams;
  const [pos, missing] = await Promise.all([
    fetchPOs(awaitedSearchParams),
    fetchMissingInvoicePos(),
  ]);
  // Compute progress ratio for each PO (total received / total ordered)
  const withProgress = pos.map((po) => {
    let ordered = 0;
    let received = 0;
    for (const l of po.lines) {
      ordered += Number(l.orderedQty);
      received += Number(l.receivedQty);
    }
    const progress = ordered > 0 ? received / ordered : 0;
    return { ...po, _progress: progress };
  });
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Bons de commande</h1>
      {missing.length > 0 && (
        <div className="border border-blue-200 bg-blue-50 rounded p-4 text-xs text-blue-900 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-sm">
              {missing.length === 1
                ? "1 bon de commande reçu n’a pas encore de facture fournisseur."
                : `${missing.length} bons de commande reçus n’ont pas encore de facture fournisseur.`}
            </span>
            <Link
              href="/incoming-invoices/create"
              className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Créer une facture maintenant
            </Link>
          </div>
          <ul className="space-y-1">
            {missing.slice(0, 5).map((po) => (
              <li key={po.id} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/purchase-orders/${po.id}`}
                  className="font-mono text-blue-700 underline"
                >
                  {po.number}
                </Link>
                <span className="text-gray-700">
                  · {po.supplier?.name || "Fournisseur inconnu"}
                </span>
              </li>
            ))}
          </ul>
          {missing.length > 5 && (
            <div className="text-[11px] text-blue-700">
              …et {missing.length - 5} de plus toujours en attente.
            </div>
          )}
        </div>
      )}
      <div>
        <Link
          href="/purchase-orders/create"
          className="inline-block mb-2 px-3 py-1 bg-green-600 text-white text-xs rounded"
        >
          Nouveau bon de commande
        </Link>
      </div>
      <form className="flex flex-wrap gap-2 text-xs bg-gray-50 p-3 rounded border">
        <input
          type="text"
          name="q"
          placeholder="Recherche numéro"
          defaultValue={awaitedSearchParams?.q || ""}
          className="border px-2 py-1 rounded"
        />
        <select
          name="status"
          defaultValue={awaitedSearchParams?.status || ""}
          className="border px-2 py-1 rounded"
        >
          <option value="">Tous statuts</option>
          {[
            "DRAFT",
            "APPROVED",
            "STAGED",
            "PARTIAL",
            "RECEIVED",
            "CLOSED",
            "CANCELLED",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="px-3 py-1 bg-blue-600 text-white rounded">
          Filtrer
        </button>
        <a href="/purchase-orders" className="px-3 py-1 bg-gray-300 rounded">
          Réinitialiser
        </a>
      </form>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Numéro</th>
            <th className="border px-2 py-1">Fournisseur</th>
            <th className="border px-2 py-1">Statut</th>
            <th className="border px-2 py-1">Lignes</th>
            <th className="border px-2 py-1">Progression</th>
            <th className="border px-2 py-1"></th>
          </tr>
        </thead>
        <tbody>
          {withProgress.map((po) => {
            const pct = (po._progress * 100).toFixed(1);
            return (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="border px-2 py-1 font-mono">
                  <Link
                    className="text-blue-600 underline"
                    href={`/purchase-orders/${po.id}`}
                  >
                    {po.number}
                  </Link>
                </td>
                <td className="border px-2 py-1">{po.supplier?.name || "-"}</td>
                <td className="border px-2 py-1">
                  <StatusBadge status={po.status} />
                </td>
                <td className="border px-2 py-1">{po.lines.length}</td>
                <td className="border px-2 py-1">
                  <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                    <div
                      className="bg-blue-600 h-2"
                      style={{ width: `${Math.min(100, po._progress * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-right font-mono">{pct}%</div>
                </td>
                <td className="border px-2 py-1 text-right">
                  <PurchaseOrderRowActions po={po} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
