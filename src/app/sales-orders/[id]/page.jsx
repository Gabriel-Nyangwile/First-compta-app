"use client";

import Link from "next/link";
import React, { useEffect, useState, Suspense } from "react";
import SalesOrderStatusCell from "@/components/salesOrders/SalesOrderStatusCell";
import Amount from "@/components/Amount";

function formatDate(value) {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "-";
  }
}

function SummarySection({ order }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 bg-white border border-slate-200 rounded px-4 py-4">
      <div className="space-y-1 text-sm text-slate-700">
        <p>
          <span className="font-medium text-slate-600">Numéro :</span>{" "}
          <span className="font-mono">{order.number}</span>
        </p>
        <p>
          <span className="font-medium text-slate-600">Client :</span>{" "}
          {order.client?.name || "—"}
        </p>
        <p>
          <span className="font-medium text-slate-600">Réf. client :</span>{" "}
          {order.customerReference || "—"}
        </p>
      </div>
      <div className="space-y-1 text-sm text-slate-700">
        <p>
          <span className="font-medium text-slate-600">Émise le :</span>{" "}
          {formatDate(order.issueDate)}
        </p>
        <p>
          <span className="font-medium text-slate-600">Livraison prévue :</span>{" "}
          {formatDate(order.expectedShipDate)}
        </p>
        <p>
          <span className="font-medium text-slate-600">Devise :</span>{" "}
          {order.currency || "—"}
        </p>
      </div>
    </section>
  );
}

function TotalsSection({ order }) {
  return (
    <section className="bg-white border border-slate-200 rounded px-4 py-4 text-sm text-slate-700 space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Totaux
      </h2>
      <p>
        Total HT : <Amount value={order.totalAmountHt} />
      </p>
      <p>
        TVA : <Amount value={order.totalVatAmount} />
      </p>
      <p>
        Total TTC : <Amount value={order.totalAmountTtc} />
      </p>
    </section>
  );
}

function LinesSection({ order }) {
  return (
    <section className="bg-white border border-slate-200 rounded px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lignes
        </h2>
        <span className="text-[11px] text-slate-500">
          {order.lines?.length || 0} ligne(s)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="border px-2 py-1 text-left">Produit</th>
              <th className="border px-2 py-1 text-right">Quantité</th>
              <th className="border px-2 py-1 text-right">PU</th>
              <th className="border px-2 py-1 text-right">Total HT</th>
              <th className="border px-2 py-1">Compte</th>
            </tr>
          </thead>
          <tbody>
            {(order.lines || []).map((line) => (
              <tr key={line.id} className="hover:bg-slate-50">
                <td className="border px-2 py-1">
                  <div className="font-medium text-slate-700">
                    {line.description || line.product?.name || "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    SKU : {line.product?.sku || "—"} • Unité :{" "}
                    {line.unit || line.product?.unit || "—"}
                  </div>
                </td>
                <td className="border px-2 py-1 text-right font-mono">
                  {Number(line.quantityOrdered || 0).toFixed(3)}
                </td>
                <td className="border px-2 py-1 text-right font-mono">
                  {Number(line.unitPrice || 0).toFixed(4)}
                </td>
                <td className="border px-2 py-1 text-right font-mono">
                  {Number(line.lineTotalHt || 0).toFixed(2)}
                </td>
                <td className="border px-2 py-1 text-sm text-slate-600">
                  {line.account?.number || "—"}{" "}
                  {line.account?.label ? `• ${line.account.label}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NotesSection({ notes }) {
  if (!notes) return null;
  return (
    <section className="bg-white border border-slate-200 rounded px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        Notes
      </h2>
      <p className="text-sm text-slate-700 whitespace-pre-line">{notes}</p>
    </section>
  );
}

function SalesOrderDetailView({ order }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Commande client {order.number}
          </h1>
          <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
            <span>Status actuel :</span>
            <SalesOrderStatusCell
              orderId={order.id}
              initialStatus={order.status}
            />
          </div>
        </div>
        <Link
          href="/sales-orders"
          className="text-sm text-blue-600 underline hover:text-blue-800"
        >
          ← Retour à la liste
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SummarySection order={order} />
        <TotalsSection order={order} />
      </div>

      <LinesSection order={order} />
      <NotesSection notes={order.notes} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-6">
      <p className="text-sm text-slate-500">Chargement de la commande…</p>
    </div>
  );
}

export default function SalesOrderDetailPage({ params }) {
  const resolvedParams = typeof params?.then === "function" ? React.use(params) : params;
  const id = resolvedParams?.id;
  const [state, setState] = useState({
    loading: true,
    error: "",
    order: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ loading: true, error: "", order: null });
      try {
        const res = await fetch(`/api/sales-orders/${id}`, {
          cache: "no-store",
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || "Commande introuvable.");
        }
        if (!cancelled) {
          setState({ loading: false, error: "", order: payload });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error.message || "Erreur inattendue.",
            order: null,
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.loading) {
    return <LoadingState />;
  }

  if (state.error) {
    return (
      <div className="p-6 space-y-3">
        <Link
          href="/sales-orders"
          className="text-sm text-blue-600 underline hover:text-blue-800"
        >
          ← Retour à la liste
        </Link>
        <div className="border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 rounded">
          {state.error}
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingState />}>
      <div className="p-6">
        <SalesOrderDetailView order={state.order} />
      </div>
    </Suspense>
  );
}
