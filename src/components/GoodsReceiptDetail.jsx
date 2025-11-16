"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { authorizedFetch } from "@/lib/apiClient";

const STATUS_BADGE = {
  OPEN: "bg-slate-200 text-slate-700",
  QC_PENDING: "bg-amber-200 text-amber-700",
  PUTAWAY_PENDING: "bg-indigo-200 text-indigo-700",
  PUTAWAY_DONE: "bg-emerald-200 text-emerald-700",
  CLOSED: "bg-emerald-200 text-emerald-700",
};

const QC_STATUS_LABEL = {
  PENDING: "QC en attente",
  ACCEPTED: "QC validé",
  REJECTED: "QC rejeté",
};

function format(number, digits = 3) {
  const value = Number(number);
  if (Number.isNaN(value)) return "0";
  return value.toFixed(digits);
}

export default function GoodsReceiptDetail({ receipt }) {
  const [expanded, setExpanded] = useState(false);
  const [busyLine, setBusyLine] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnDraft, setReturnDraft] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const lines = useMemo(() => {
    return (receipt.lines || []).map((line) => {
      const qtyReceived = Number(line.qtyReceived || 0);
      const qtyPutAway = Number(line.qtyPutAway || 0);
      const returnOrderLines = (line.returnOrderLines || []).map((rol) => ({
        ...rol,
        quantity: Number(rol.quantity || 0),
      }));
      const returnedQty =
        line.returnedQty != null
          ? Number(line.returnedQty)
          : returnOrderLines
              .filter((rol) => rol.returnOrder?.status !== "CANCELLED")
              .reduce((sum, rol) => sum + Number(rol.quantity || 0), 0);
      const availableForReturn =
        line.availableForReturn != null
          ? Number(line.availableForReturn)
          : Math.max(0, qtyPutAway - returnedQty);
      const unitCostNumber = Number(line.unitCost ?? 0);
      return {
        ...line,
        qtyReceived,
        qtyPutAway,
        returnOrderLines,
        returnedQty,
        availableForReturn,
        unitCostNumber: Number.isFinite(unitCostNumber) ? unitCostNumber : 0,
      };
    });
  }, [receipt.lines]);

  const returnableLines = useMemo(
    () => lines.filter((line) => line.availableForReturn > 1e-6),
    [lines]
  );

  const hasReturnableLines = returnableLines.length > 0;
  const canCreateReturn = Boolean(receipt.supplier?.id) && hasReturnableLines;

  const hasReturnSelection = Object.values(returnDraft).some((entry) => {
    const qty = Number(entry?.quantity);
    return Number.isFinite(qty) && qty > 0;
  });

  async function callAction(lineId, payload) {
    setBusyLine(lineId);
    setMessage(null);
    setError(null);
    try {
      const res = await authorizedFetch(`/api/goods-receipts/${receipt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, lineId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur action");
      setMessage(
        "Action enregistrée. Actualise la page pour voir les dernières données."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyLine(null);
    }
  }

  function handleAccept(line) {
    const remaining = Number(line.qtyReceived) - Number(line.qtyPutAway || 0);
    const status = remaining <= 1e-9 ? "PUTAWAY_DONE" : "PUTAWAY_PENDING";
    if (status === "PUTAWAY_DONE") {
      return callAction(line.id, { action: "QC_ACCEPT", putAway: true });
    }
    return callAction(line.id, { action: "QC_ACCEPT" });
  }

  function handleReject(line) {
    const defaultQty = Math.max(
      0,
      Number(line.qtyReceived) - Number(line.qtyPutAway || 0)
    );
    const qty = prompt("Quantité à rejeter ?", String(defaultQty));
    if (qty === null) return;
    const parsed = Number(qty);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError("Quantité invalide");
      return;
    }
    callAction(line.id, { action: "QC_REJECT", qty: parsed });
  }

  function handlePutAway(line) {
    const remaining = Math.max(
      0,
      Number(line.qtyReceived) - Number(line.qtyPutAway || 0)
    );
    const qty = prompt("Quantité à ranger ?", String(remaining));
    if (qty === null) return;
    const parsed = Number(qty);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setError("Quantité invalide");
      return;
    }
    const unitCost = prompt(
      "Coût unitaire (optionnel)",
      String(line.unitCost || "")
    );
    const payload = { action: "PUTAWAY", qty: parsed };
    if (unitCost !== null && unitCost.trim()) {
      const cost = Number(unitCost);
      if (!Number.isNaN(cost) && cost >= 0) {
        payload.unitCost = cost;
      }
    }
    const location = prompt(
      "Emplacement stockage (optionnel)",
      line.storageLocation?.code || ""
    );
    if (location && location.trim()) {
      payload.storageLocationCode = location.trim();
    }
    callAction(line.id, payload);
  }

  const badgeClass =
    STATUS_BADGE[receipt.status] || "bg-slate-200 text-slate-700";

  function toggleReturnForm() {
    setShowReturnForm((prev) => {
      const next = !prev;
      if (next) {
        const initial = {};
        returnableLines.forEach((line) => {
          initial[line.id] = {
            quantity: "",
            unitCost:
              line.unitCostNumber > 0
                ? String(line.unitCostNumber.toFixed(4))
                : "",
            reason: "",
          };
        });
        setReturnDraft(initial);
      } else {
        setReturnDraft({});
        setReturnReason("");
        setReturnNotes("");
      }
      return next;
    });
  }

  function updateReturnDraft(lineId, field, value) {
    setReturnDraft((prev) => ({
      ...prev,
      [lineId]: {
        ...(prev[lineId] || {}),
        [field]: value,
      },
    }));
  }

  async function submitReturnOrder() {
    if (!canCreateReturn) {
      setError(
        "Impossible de créer un retour fournisseur sans fournisseur associé."
      );
      return;
    }
    setReturnSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const payloadLines = returnableLines
        .map((line) => {
          const entry = returnDraft[line.id];
          const qty = Number(entry?.quantity ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) return null;
          if (qty > line.availableForReturn + 1e-6) {
            throw new Error(
              `Quantité de retour supérieure au disponible pour ${
                line.product?.name || line.productId
              }`
            );
          }
          const payload = {
            goodsReceiptLineId: line.id,
            quantity: qty,
          };
          const unitCost = Number(entry?.unitCost);
          if (Number.isFinite(unitCost) && unitCost >= 0) {
            payload.unitCost = unitCost;
          }
          const reason = entry?.reason?.trim();
          if (reason) payload.reason = reason;
          return payload;
        })
        .filter(Boolean);

      if (!payloadLines.length) {
        setError(
          "Sélectionnez au moins une ligne avec une quantité à retourner."
        );
        setReturnSubmitting(false);
        return;
      }

      const body = {
        supplierId: receipt.supplier?.id,
        purchaseOrderId: receipt.purchaseOrder?.id || undefined,
        goodsReceiptId: receipt.id,
        reason: returnReason.trim() || undefined,
        notes: returnNotes.trim() || undefined,
        lines: payloadLines,
      };

      const res = await fetch("/api/return-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Erreur création retour fournisseur");
      }

      setMessage(
        data?.number
          ? `Retour fournisseur ${data.number} créé. Actualise la page pour voir les dernières données.`
          : "Retour fournisseur créé. Actualise la page pour voir les dernières données."
      );
      setShowReturnForm(false);
      setReturnDraft({});
      setReturnReason("");
      setReturnNotes("");
    } catch (err) {
      setError(err.message);
    } finally {
      setReturnSubmitting(false);
    }
  }

  return (
    <div className="border rounded">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="px-3 py-2 flex flex-wrap gap-4 items-center bg-gray-50 text-xs w-full text-left"
      >
        <div className="font-mono">{receipt.number}</div>
        <div className={`px-2 py-0.5 rounded ${badgeClass}`}>
          {receipt.status}
        </div>
        <div>{new Date(receipt.receiptDate).toLocaleDateString()}</div>
        <div>{lines.length} ligne(s)</div>
        {receipt.summary && (
          <div className="ml-auto flex gap-3 text-[10px] text-gray-600">
            <span>QC pending: {receipt.summary.qcPending}</span>
            <span>Put-away en attente: {receipt.summary.putAwayPending}</span>
            <span>
              Retour dispo: {format(receipt.summary.returnableQty || 0)}
            </span>
          </div>
        )}
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          {message && <div className="text-xs text-emerald-600">{message}</div>}
          {error && <div className="text-xs text-red-600">{error}</div>}
          <table className="w-full text-[11px] border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-1 py-1 text-left">Produit</th>
                <th className="border px-1 py-1">Qté reçue</th>
                <th className="border px-1 py-1">Qté rangée</th>
                <th className="border px-1 py-1">Qté retournée</th>
                <th className="border px-1 py-1">Retour dispo</th>
                <th className="border px-1 py-1">Statut ligne</th>
                <th className="border px-1 py-1">QC</th>
                <th className="border px-1 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const remaining = Math.max(
                  0,
                  Number(line.qtyReceived) - Number(line.qtyPutAway || 0)
                );
                const qcLabel = QC_STATUS_LABEL[line.qcStatus] || line.qcStatus;
                return (
                  <tr key={line.id}>
                    <td className="border px-1 py-1">
                      <div className="flex flex-col">
                        <span>{line.product?.name || line.productId}</span>
                        {line.purchaseOrderLine && (
                          <span className="text-[10px] text-gray-500">
                            PO line #{line.purchaseOrderLine.id.slice(0, 6)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border px-1 py-1 text-right font-mono">
                      {format(line.qtyReceived)}
                    </td>
                    <td className="border px-1 py-1 text-right font-mono">
                      {format(line.qtyPutAway || 0)}
                    </td>
                    <td className="border px-1 py-1 text-right font-mono">
                      {format(line.returnedQty || 0)}
                      {line.returnedQty > 0 && (
                        <span className="ml-1 inline-block bg-orange-200 text-orange-800 text-[10px] px-1.5 py-0.5 rounded-full align-middle">
                          ↩ {format(line.returnedQty)}
                        </span>
                      )}
                    </td>
                    <td className="border px-1 py-1 text-right font-mono">
                      {format(line.availableForReturn || 0)}
                    </td>
                    <td className="border px-1 py-1 text-center">
                      {line.status}
                    </td>
                    <td className="border px-1 py-1 text-center">{qcLabel}</td>
                    <td className="border px-1 py-1">
                      <div className="flex flex-wrap gap-1">
                        {line.qcStatus === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleAccept(line)}
                            disabled={busyLine === line.id}
                            className="px-2 py-0.5 text-[10px] bg-emerald-600 text-white rounded"
                          >
                            Valider QC
                          </button>
                        )}
                        {line.qcStatus === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleReject(line)}
                            disabled={busyLine === line.id}
                            className="px-2 py-0.5 text-[10px] bg-red-600 text-white rounded"
                          >
                            Rejeter
                          </button>
                        )}
                        {line.qcStatus === "ACCEPTED" &&
                          line.status !== "PUTAWAY_DONE" &&
                          remaining > 0 && (
                            <button
                              type="button"
                              onClick={() => handlePutAway(line)}
                              disabled={busyLine === line.id}
                              className="px-2 py-0.5 text-[10px] bg-indigo-600 text-white rounded"
                            >
                              Ranger
                            </button>
                          )}
                        {line.qcStatus === "ACCEPTED" &&
                          line.status === "PUTAWAY_DONE" && (
                            <span className="px-2 py-0.5 text-[10px] bg-emerald-200 text-emerald-700 rounded">
                              Terminé
                            </span>
                          )}
                        {line.qcStatus === "REJECTED" && (
                          <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded">
                            Rejeté
                          </span>
                        )}
                        {line.returnOrderLines?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {line.returnOrderLines.map((rol) => (
                              <Link
                                key={rol.id}
                                href={
                                  rol.returnOrder?.id
                                    ? `/return-orders/${rol.returnOrder.id}`
                                    : "#"
                                }
                                className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded underline decoration-dotted"
                              >
                                {(rol.returnOrder?.number || "Retour") +
                                  ` (${format(rol.quantity)})`}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="space-y-2 border border-dashed border-slate-200 rounded p-3 bg-slate-50/40">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-700">
              <button
                type="button"
                onClick={toggleReturnForm}
                disabled={!canCreateReturn || returnSubmitting}
                className="px-3 py-1.5 rounded bg-amber-600 text-white text-[11px] disabled:opacity-50 disabled:bg-amber-400"
              >
                {showReturnForm
                  ? "Fermer le formulaire retour"
                  : "Créer un retour fournisseur"}
              </button>
              {canCreateReturn && (
                <Link
                  href={`/return-orders/create?goodsReceiptId=${receipt.id}`}
                  className="text-blue-600 underline"
                >
                  Ouvrir dans une nouvelle page
                </Link>
              )}
              {!receipt.supplier?.id && (
                <span className="text-red-600">
                  Aucun fournisseur lié à cette réception — retour impossible.
                </span>
              )}
              {receipt.supplier?.id && !hasReturnableLines && (
                <span className="text-slate-500">
                  Aucune quantité rangée disponible pour un retour.
                </span>
              )}
            </div>
            {showReturnForm && (
              <div className="space-y-3 bg-white border border-amber-200 rounded p-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px] border">
                    <thead className="bg-amber-50 text-amber-800 uppercase tracking-wide">
                      <tr>
                        <th className="border px-2 py-1 text-left">Produit</th>
                        <th className="border px-2 py-1 text-right">Rangé</th>
                        <th className="border px-2 py-1 text-right">
                          Retour dispo
                        </th>
                        <th className="border px-2 py-1 text-right">
                          Qté retour
                        </th>
                        <th className="border px-2 py-1 text-right">
                          Coût unitaire
                        </th>
                        <th className="border px-2 py-1 text-left">
                          Motif ligne
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnableLines.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-4 text-center text-slate-500"
                          >
                            Aucune ligne disponible pour un retour.
                          </td>
                        </tr>
                      )}
                      {returnableLines.map((line) => {
                        const draft = returnDraft[line.id] || {
                          quantity: "",
                          unitCost: "",
                          reason: "",
                        };
                        return (
                          <tr key={`return-${line.id}`}>
                            <td className="border px-2 py-1">
                              <div className="flex flex-col gap-0.5">
                                <span>
                                  {line.product?.name || line.productId}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {line.id.slice(0, 8)}
                                </span>
                              </div>
                            </td>
                            <td className="border px-2 py-1 text-right font-mono">
                              {format(line.qtyPutAway)}
                            </td>
                            <td className="border px-2 py-1 text-right font-mono">
                              {format(line.availableForReturn)}
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                max={line.availableForReturn}
                                value={draft.quantity}
                                onChange={(event) =>
                                  updateReturnDraft(
                                    line.id,
                                    "quantity",
                                    event.target.value
                                  )
                                }
                                className="w-full border rounded px-1 py-0.5 text-right"
                                placeholder="0.000"
                              />
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={draft.unitCost}
                                onChange={(event) =>
                                  updateReturnDraft(
                                    line.id,
                                    "unitCost",
                                    event.target.value
                                  )
                                }
                                className="w-full border rounded px-1 py-0.5 text-right"
                                placeholder="Automatique"
                              />
                            </td>
                            <td className="border px-2 py-1">
                              <input
                                type="text"
                                value={draft.reason}
                                onChange={(event) =>
                                  updateReturnDraft(
                                    line.id,
                                    "reason",
                                    event.target.value
                                  )
                                }
                                className="w-full border rounded px-1 py-0.5"
                                placeholder="Motif retour (optionnel)"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="font-semibold uppercase tracking-wide text-amber-800">
                      Motif global (optionnel)
                    </span>
                    <textarea
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                      className="w-full border rounded px-2 py-1"
                      rows={2}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold uppercase tracking-wide text-amber-800">
                      Notes internes
                    </span>
                    <textarea
                      value={returnNotes}
                      onChange={(event) => setReturnNotes(event.target.value)}
                      className="w-full border rounded px-2 py-1"
                      rows={2}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={submitReturnOrder}
                    disabled={returnSubmitting || !hasReturnSelection}
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50 disabled:bg-emerald-400"
                  >
                    {returnSubmitting
                      ? "Création en cours…"
                      : "Enregistrer le retour"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleReturnForm}
                    className="px-3 py-1.5 rounded border border-slate-300"
                    disabled={returnSubmitting}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
          {Array.isArray(receipt.returnOrders) &&
            receipt.returnOrders.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold">
                  Retours fournisseurs liés
                </h3>
                <ul className="space-y-1">
                  {receipt.returnOrders.map((order) => (
                    <li
                      key={order.id}
                      className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-100/80 rounded px-2 py-1"
                    >
                      <span className="font-mono">{order.number}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-300 text-slate-700">
                        {order.status}
                      </span>
                      {order.issuedAt && (
                        <span className="text-slate-500">
                          {new Date(order.issuedAt).toLocaleDateString()}
                        </span>
                      )}
                      <Link
                        href={`/return-orders/${order.id}`}
                        className="ml-auto text-blue-600 underline"
                      >
                        Consulter
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          {receipt.status === "OPEN" && (
            <div className="text-[10px] text-gray-500">
              Annulation possible uniquement tant que la réception est en statut
              OPEN.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
