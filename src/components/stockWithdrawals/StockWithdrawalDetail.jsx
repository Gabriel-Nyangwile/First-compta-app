"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StockWithdrawalStatusBadge from "./StockWithdrawalStatusBadge";
import StockWithdrawalForm from "./StockWithdrawalForm";
import { TYPE_LABELS } from "./constants";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
}

function formatQuantity(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(3);
}

function formatAmount(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0.00";
  return numeric.toFixed(2);
}

export default function StockWithdrawalDetail({ id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock-withdrawals/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Impossible de charger la sortie.");
      }
      const payload = await res.json();
      setData(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const lines = useMemo(() => data?.lines ?? [], [data?.lines]);

  const handleAction = async (action) => {
    if (!data) return;
    setActionLoading(action);
    setFeedback("");
    setError(null);
    try {
      const res = await fetch(`/api/stock-withdrawals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Action impossible.");
      }
      setData(payload);
      setEditMode(false);
      setFeedback(
        action === "CONFIRM"
          ? "Sortie confirmée."
          : action === "POST"
          ? "Sortie enregistrée et mouvements créés."
          : action === "CANCEL"
          ? "Sortie annulée."
          : "Statut mis à jour."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSuccess = (updated) => {
    setData(updated);
    setEditMode(false);
    setFeedback("Sortie mise à jour.");
  };

  if (loading) {
    return (
      <div className="border border-slate-200 rounded bg-white px-4 py-6 text-sm text-slate-500">
        Chargement de la sortie…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="border border-rose-200 bg-rose-50 text-rose-700 px-4 py-6 rounded text-sm">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      <section className="border border-slate-200 bg-white rounded px-4 py-4 space-y-2">
        <header className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold font-mono">{data.number}</h2>
          <StockWithdrawalStatusBadge status={data.status} />
          <span className="text-sm text-slate-600">
            {TYPE_LABELS[data.type] || data.type}
          </span>
          <span className="ml-auto text-xs text-slate-500">
            Créée le {formatDate(data.requestedAt)}
          </span>
        </header>
        <dl className="grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Demandeur
            </dt>
            <dd>
              {data.requestedBy?.username ||
                data.requestedBy?.email ||
                data.requestedById ||
                "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Ordre fabrication
            </dt>
            <dd>{data.manufacturingOrderRef || "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              Commande client
            </dt>
            <dd>{data.salesOrderRef || "—"}</dd>
          </div>
          <div className="flex gap-6 text-xs text-slate-500">
            {data.confirmedAt && (
              <span>Confirmée le {formatDate(data.confirmedAt)}</span>
            )}
            {data.postedAt && (
              <span>Enregistrée le {formatDate(data.postedAt)}</span>
            )}
          </div>
        </dl>
        {data.notes && (
          <p className="text-sm text-slate-600 border-t border-slate-100 pt-2">
            {data.notes}
          </p>
        )}
      </section>

      {feedback && (
        <div className="border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 rounded text-sm">
          {feedback}
        </div>
      )}
      {error && data && (
        <div className="border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {editMode ? (
        <section className="border border-slate-200 bg-white rounded px-4 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-3">
            Modifier le brouillon
          </h3>
          <StockWithdrawalForm
            mode="edit"
            initialData={data}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditMode(false)}
          />
        </section>
      ) : (
        <section className="border border-slate-200 bg-white rounded px-4 py-4 space-y-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Lignes et mouvements
            </h3>
            {data.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="text-[11px] text-blue-600 hover:text-blue-700 underline"
              >
                Modifier le brouillon
              </button>
            )}
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-slate-200">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="border border-slate-200 px-2 py-1 text-left">
                    Produit
                  </th>
                  <th className="border border-slate-200 px-2 py-1 text-left">
                    Quantité
                  </th>
                  <th className="border border-slate-200 px-2 py-1 text-left">
                    Coût unitaire
                  </th>
                  <th className="border border-slate-200 px-2 py-1 text-left">
                    Total
                  </th>
                  <th className="border border-slate-200 px-2 py-1 text-left">
                    Mouvements
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center text-sm text-slate-500 py-4"
                    >
                      Aucune ligne pour cette sortie.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr
                      key={line.id || line.productId}
                      className="odd:bg-white even:bg-slate-50"
                    >
                      <td className="border border-slate-200 px-2 py-1">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-slate-600">
                            {line.product?.sku || line.productId}
                          </span>
                          <span className="text-sm text-slate-700">
                            {line.product?.name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        {formatQuantity(line.quantity)}{" "}
                        {line.product?.unit || ""}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        {line.unitCost != null
                          ? `${formatAmount(line.unitCost)} €`
                          : "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        {line.totalCost != null
                          ? `${formatAmount(line.totalCost)} €`
                          : "—"}
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        <ul className="text-xs text-slate-600 space-y-1">
                          {(line.movements || []).map((movement) => (
                            <li key={movement.id} className="flex gap-2">
                              <span className="font-mono text-[11px] text-slate-500">
                                {formatDate(movement.date)}
                              </span>
                              <span>
                                {formatQuantity(movement.quantity)} @{" "}
                                {movement.unitCost != null
                                  ? `${formatAmount(movement.unitCost)} €`
                                  : ""}
                              </span>
                            </li>
                          ))}
                          {!line.movements?.length && <li>—</li>}
                        </ul>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="border border-slate-200 bg-white rounded px-4 py-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Actions
        </h3>
        {data.status === "DRAFT" && (
          <>
            <button
              type="button"
              onClick={() => handleAction("CONFIRM")}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={actionLoading === "CONFIRM"}
            >
              {actionLoading === "CONFIRM" ? "Confirmation…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => handleAction("CANCEL")}
              className="text-sm px-3 py-1.5 text-rose-600 hover:text-rose-700 disabled:opacity-50"
              disabled={actionLoading === "CANCEL"}
            >
              {actionLoading === "CANCEL" ? "Annulation…" : "Annuler"}
            </button>
          </>
        )}
        {data.status === "CONFIRMED" && (
          <>
            <button
              type="button"
              onClick={() => handleAction("POST")}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm hover:bg-emerald-700 disabled:opacity-50"
              disabled={actionLoading === "POST"}
            >
              {actionLoading === "POST" ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => handleAction("CANCEL")}
              className="text-sm px-3 py-1.5 text-rose-600 hover:text-rose-700 disabled:opacity-50"
              disabled={actionLoading === "CANCEL"}
            >
              {actionLoading === "CANCEL" ? "Annulation…" : "Annuler"}
            </button>
          </>
        )}
        {data.status === "POSTED" && (
          <span className="text-sm text-slate-500">
            Sortie enregistrée. Aucun autre traitement nécessaire.
          </span>
        )}
        {data.status === "CANCELLED" && (
          <span className="text-sm text-slate-500">
            Sortie annulée. Aucune action supplémentaire.
          </span>
        )}
      </section>
    </div>
  );
}
