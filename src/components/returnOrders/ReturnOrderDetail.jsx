"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReturnOrderStatusBadge from "./ReturnOrderStatusBadge";

const STATUS_CHOICES = [
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

function formatNumber(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(digits);
}

export default function ReturnOrderDetail({ orderId }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("DRAFT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/return-orders/${orderId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Retour fournisseur introuvable");
        }
        const data = await res.json();
        if (cancel) return;
        setOrder(data);
        setStatus(data.status);
        setNotes(data.notes || "");
      } catch (err) {
        if (!cancel) setError(err.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [orderId]);

  const handleStatusChange = (event) => setStatus(event.target.value);

  const totalQuantity = useMemo(() => {
    if (!order?.lines?.length) return 0;
    return order.lines.reduce(
      (acc, line) => acc + Number(line.quantity || 0),
      0
    );
  }, [order?.lines]);

  async function saveStatus() {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/return-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Erreur mise à jour retour fournisseur");
      }
      setOrder(data);
      setStatus(data.status);
      setNotes(data.notes || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 text-sm text-slate-600">Chargement retour…</div>
    );
  }

  if (error) {
    return <div className="px-4 py-6 text-sm text-rose-600">{error}</div>;
  }

  if (!order) {
    return (
      <div className="px-4 py-6 text-sm text-slate-600">
        Retour introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold font-mono">{order.number}</h2>
        <ReturnOrderStatusBadge status={order.status} />
        <span className="text-sm text-slate-600">
          {order.supplier?.name || "Fournisseur inconnu"}
        </span>
        <span className="text-[12px] text-slate-400">
          Créé le {formatDate(order.createdAt)}
        </span>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="border border-slate-200 rounded px-3 py-2 bg-white">
          <div className="text-[11px] uppercase text-slate-500">
            Réception liée
          </div>
          {order.goodsReceipt ? (
            <Link
              href={`/goods-receipts/${order.goodsReceipt.id}`}
              className="text-sm text-blue-600 underline"
            >
              {order.goodsReceipt.number}
            </Link>
          ) : (
            <span className="text-sm text-slate-500">Aucune</span>
          )}
        </div>
        <div className="border border-slate-200 rounded px-3 py-2 bg-white">
          <div className="text-[11px] uppercase text-slate-500">
            Bon de commande
          </div>
          {order.purchaseOrder ? (
            <Link
              href={`/purchase-orders/${order.purchaseOrder.id}`}
              className="text-sm text-blue-600 underline"
            >
              {order.purchaseOrder.number}
            </Link>
          ) : (
            <span className="text-sm text-slate-500">Aucun</span>
          )}
        </div>
        <div className="border border-slate-200 rounded px-3 py-2 bg-white">
          <div className="text-[11px] uppercase text-slate-500">Lignes</div>
          <div className="text-sm text-slate-600">
            {order.lines?.length || 0} ligne(s)
          </div>
          <div className="text-[12px] text-slate-500">
            {totalQuantity.toFixed(3)} unités
          </div>
        </div>
      </section>

      <section className="space-y-2 bg-white border border-slate-200 rounded">
        <header className="px-3 py-2 border-b border-slate-200 bg-slate-50 uppercase text-[11px] tracking-wide text-slate-500">
          Détails des lignes
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-2 py-1 text-left">Produit</th>
                <th className="px-2 py-1 text-right">Quantité</th>
                <th className="px-2 py-1 text-right">Coût unitaire</th>
                <th className="px-2 py-1 text-right">Montant</th>
                <th className="px-2 py-1 text-left">Motif</th>
              </tr>
            </thead>
            <tbody>
              {order.lines?.map((line) => {
                const quantity = Number(line.quantity || 0);
                const unitCost = Number(line.unitCost || 0);
                const total = quantity * unitCost;
                return (
                  <tr key={line.id} className="border-t border-slate-100">
                    <td className="px-2 py-1">
                      <div className="flex flex-col">
                        <span>{line.product?.name || line.productId}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {line.goodsReceiptLineId?.slice(0, 8) || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {formatNumber(quantity)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {formatNumber(unitCost, 4)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {formatNumber(total, 2)}
                    </td>
                    <td className="px-2 py-1">{line.reason || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2 bg-white border border-slate-200 rounded p-3">
        <div className="text-[11px] uppercase text-slate-500 tracking-wide">
          Notes internes
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          rows={4}
        />
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <label className="flex items-center gap-2">
            <span>Statut</span>
            <select
              value={status}
              onChange={handleStatusChange}
              className="border rounded px-2 py-1 text-sm"
            >
              {STATUS_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={saveStatus}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {error && <span className="text-rose-600">{error}</span>}
        </div>
      </section>

      {order.lines?.some((line) => line.stockMovements?.length) && (
        <section className="space-y-2 border border-slate-200 rounded bg-white">
          <header className="px-3 py-2 border-b border-slate-200 bg-slate-50 uppercase text-[11px] tracking-wide text-slate-500">
            Mouvements de stock liés
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Produit</th>
                  <th className="px-2 py-1 text-right">Quantité</th>
                  <th className="px-2 py-1 text-right">Coût</th>
                  <th className="px-2 py-1 text-right">Total</th>
                  <th className="px-2 py-1 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.flatMap((line) =>
                  (line.stockMovements || []).map((movement) => (
                    <tr key={movement.id} className="border-t border-slate-100">
                      <td className="px-2 py-1 flex flex-col">
                        <span>{line.product?.name || line.productId}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {movement.id.slice(0, 10)}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right font-mono">
                        {formatNumber(movement.quantity)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono">
                        {formatNumber(movement.unitCost, 4)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono">
                        {formatNumber(movement.totalCost, 2)}
                      </td>
                      <td className="px-2 py-1 text-left">
                        {formatDate(movement.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
