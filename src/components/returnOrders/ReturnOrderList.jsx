"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import ReturnOrderStatusBadge from "./ReturnOrderStatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "Tous statuts" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "SENT", label: "Envoyé" },
  { value: "CLOSED", label: "Clôturé" },
  { value: "CANCELLED", label: "Annulé" },
];

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch (err) {
    return value;
  }
}

function summarizeLines(lines = []) {
  if (!lines.length) return "0 ligne";
  const total = lines.reduce(
    (acc, line) => acc + Number(line.quantity || 0),
    0
  );
  const productNames = Array.from(
    new Set(lines.map((line) => line.product?.name || line.productId))
  );
  const head = productNames.slice(0, 3).join(", ");
  const suffix = productNames.length > 3 ? ` +${productNames.length - 3}` : "";
  return `${lines.length} ligne(s) • ${total.toFixed(3)} unités${
    head ? ` • ${head}${suffix}` : ""
  }`;
}

export default function ReturnOrderList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "", q: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const debouncedSearch = useDebouncedCallback((value) => {
    setFilters((prev) => ({ ...prev, q: value }));
  }, 300);

  useEffect(() => {
    let cancel = false;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.status) params.set("status", filters.status);
        if (filters.q) params.set("q", filters.q);
        const queryString = params.toString();
        const res = await fetch(
          queryString
            ? `/api/return-orders?${queryString}`
            : `/api/return-orders`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data?.error || "Impossible de charger les retours fournisseurs"
          );
        }
        const data = await res.json();
        if (cancel) return;
        setItems(data?.returnOrders || []);
      } catch (err) {
        if (!cancel) setError(err.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
      controller.abort();
    };
  }, [filters.status, filters.q]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    debouncedSearch(value.trim());
  };

  useEffect(() => {
    setSearchTerm(filters.q);
  }, [filters.q]);

  const resetFilters = () => {
    debouncedSearch.cancel();
    setSearchTerm("");
    setFilters({ status: "", q: "" });
  };

  const dataset = useMemo(() => items ?? [], [items]);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded px-4 py-3">
        <label className="flex flex-col text-sm">
          <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
            Statut
          </span>
          <select
            value={filters.status}
            onChange={handleFilterChange("status")}
            className="border rounded px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
            Recherche
          </span>
          <input
            type="search"
            placeholder="Numéro retour, fournisseur, PO…"
            value={searchTerm}
            onChange={handleSearchChange}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        {loading && (
          <span className="text-[11px] text-slate-500">Chargement…</span>
        )}
        {error && <span className="text-[11px] text-rose-600">{error}</span>}
        <button
          type="button"
          onClick={resetFilters}
          className="ml-auto text-[11px] text-slate-500 hover:text-slate-700 underline"
        >
          Réinitialiser
        </button>
        {!loading && !error && (
          <span className="text-[11px] text-slate-400">
            {dataset.length} résultat{dataset.length > 1 ? "s" : ""}
          </span>
        )}
      </section>
      <section className="grid gap-3">
        {dataset.length === 0 && !loading ? (
          <div className="px-4 py-6 border border-dashed rounded text-center text-sm text-slate-500 bg-slate-50">
            Aucun retour fournisseur pour le moment.
          </div>
        ) : (
          dataset.map((order) => (
            <article
              key={order.id}
              className="border border-slate-200 rounded bg-white px-4 py-3 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm">{order.number}</span>
                <ReturnOrderStatusBadge status={order.status} />
                {order.supplier?.name && (
                  <span className="text-sm text-slate-600">
                    {order.supplier.name}
                  </span>
                )}
                {order.goodsReceipt?.number && (
                  <Link
                    href={`/goods-receipts/${order.goodsReceipt.id}`}
                    className="text-[13px] text-blue-600 underline"
                  >
                    Réception {order.goodsReceipt.number}
                  </Link>
                )}
                {order.purchaseOrder?.number && (
                  <Link
                    href={`/purchase-orders/${order.purchaseOrder.id}`}
                    className="text-[13px] text-blue-600 underline"
                  >
                    BC {order.purchaseOrder.number}
                  </Link>
                )}
                <span className="ml-auto text-[11px] text-slate-400">
                  Créé le {formatDate(order.createdAt)}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-slate-600">
                {summarizeLines(order.lines)}
              </div>
              <div className="mt-3">
                <Link
                  href={`/return-orders/${order.id}`}
                  className="inline-flex items-center gap-1 text-[12px] text-blue-600 underline"
                >
                  Consulter le retour
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
