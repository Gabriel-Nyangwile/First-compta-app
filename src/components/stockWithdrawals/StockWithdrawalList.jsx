"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import StockWithdrawalStatusBadge from "./StockWithdrawalStatusBadge";
import { STATUS_LABELS, TYPE_LABELS, TYPE_OPTIONS } from "./constants";

const STATUS_OPTIONS = [
  { value: "", label: "Tous statuts" },
  { value: "DRAFT", label: STATUS_LABELS.DRAFT },
  { value: "CONFIRMED", label: STATUS_LABELS.CONFIRMED },
  { value: "POSTED", label: STATUS_LABELS.POSTED },
  { value: "CANCELLED", label: STATUS_LABELS.CANCELLED },
];

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "Tous types" },
  ...TYPE_OPTIONS,
];

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch (err) {
    return value;
  }
}

function formatQuantity(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(3);
}

function summarizeLinks(withdrawal) {
  const refs = [];
  if (withdrawal.manufacturingOrderRef) {
    refs.push(`OF ${withdrawal.manufacturingOrderRef}`);
  }
  if (withdrawal.salesOrderRef) {
    refs.push(`Commande ${withdrawal.salesOrderRef}`);
  }
  return refs.join(" • ");
}

export default function StockWithdrawalList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "", type: "", q: "" });
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
        if (filters.type) params.set("type", filters.type);
        if (filters.q) params.set("q", filters.q);
        const query = params.toString();
        const res = await fetch(
          query ? `/api/stock-withdrawals?${query}` : "/api/stock-withdrawals",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data?.error || "Impossible de charger les sorties de stock"
          );
        }
        const data = await res.json();
        if (!cancel) setItems(data || []);
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
  }, [filters.status, filters.type, filters.q]);

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
    setFilters({ status: "", type: "", q: "" });
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
            Type
          </span>
          <select
            value={filters.type}
            onChange={handleFilterChange("type")}
            className="border rounded px-2 py-1 text-sm"
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
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
            placeholder="Numéro, OF, commande…"
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
        <Link
          href="/stock-withdrawals/create"
          className="text-[11px] bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Nouvelle sortie
        </Link>
        {!loading && !error && (
          <span className="text-[11px] text-slate-400">
            {dataset.length} résultat{dataset.length > 1 ? "s" : ""}
          </span>
        )}
      </section>
      <section className="grid gap-3">
        {dataset.length === 0 && !loading ? (
          <div className="px-4 py-6 border border-dashed rounded text-center text-sm text-slate-500 bg-slate-50">
            Aucune sortie de stock pour le moment.
          </div>
        ) : (
          dataset.map((withdrawal) => (
            <article
              key={withdrawal.id}
              className="border border-slate-200 rounded bg-white px-4 py-3 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm">{withdrawal.number}</span>
                <StockWithdrawalStatusBadge status={withdrawal.status} />
                <span className="text-sm text-slate-600">
                  {TYPE_LABELS[withdrawal.type] || withdrawal.type}
                </span>
                {summarizeLinks(withdrawal) && (
                  <span className="text-xs text-slate-500">
                    {summarizeLinks(withdrawal)}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-slate-400">
                  Demandée le {formatDate(withdrawal.requestedAt)}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-slate-600">
                {withdrawal.lines?.length || 0} ligne(s) • {" "}
                {formatQuantity(withdrawal.totalQuantity)} unité(s)
              </div>
              <div className="mt-3">
                <Link
                  href={`/stock-withdrawals/${withdrawal.id}`}
                  className="inline-flex items-center gap-1 text-[12px] text-blue-600 underline"
                >
                  Consulter la sortie
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
