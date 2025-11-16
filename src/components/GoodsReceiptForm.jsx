"use client";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import { authorizedFetch } from "@/lib/apiClient";

function buildInitialOptions(purchaseOrders = [], initialPurchaseOrder = null) {
  const seen = new Set();
  const ordered = [];
  if (initialPurchaseOrder?.id && !seen.has(initialPurchaseOrder.id)) {
    seen.add(initialPurchaseOrder.id);
    ordered.push(initialPurchaseOrder);
  }
  purchaseOrders.forEach((po) => {
    if (po?.id && !seen.has(po.id)) {
      seen.add(po.id);
      ordered.push(po);
    }
  });
  return ordered;
}

function normalizeDecimal(value, fallback = 0) {
  if (value == null) return fallback;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundTo(value, precision = 3) {
  const power = 10 ** precision;
  return Math.max(0, Math.round(value * power) / power);
}

function buildPoLineEntries(purchaseOrder) {
  if (!purchaseOrder?.lines) return [];
  return purchaseOrder.lines
    .map((line) => {
      if (!line) return null;
      const orderedQty = normalizeDecimal(line.orderedQty, 0);
      const receivedQty = normalizeDecimal(line.receivedQty, 0);
      const remainingSource =
        line.remainingQty != null
          ? normalizeDecimal(line.remainingQty, 0)
          : orderedQty - receivedQty;
      const remainingQty = roundTo(remainingSource, 3);
      if (remainingQty <= 1e-9) return null;
      const defaultUnitCost = normalizeDecimal(
        line.expectedUnitPrice ?? line.unitPrice,
        0
      );
      return {
        id: line.id,
        productId: line.productId,
        productName: line.product?.name || line.productId,
        orderedQty,
        receivedQty,
        remainingQty,
        qty: "",
        unitCost: defaultUnitCost ? String(defaultUnitCost) : "",
        unitPrice: normalizeDecimal(line.unitPrice, 0),
        version: line.version ?? null,
      };
    })
    .filter(Boolean);
}

export default function GoodsReceiptForm({
  purchaseOrders = [],
  initialPurchaseOrderId = "",
  initialPurchaseOrder = null,
}) {
  const [poOptions, setPoOptions] = useState(() =>
    buildInitialOptions(purchaseOrders, initialPurchaseOrder)
  );

  useEffect(() => {
    setPoOptions((prev) => {
      const merged = buildInitialOptions(purchaseOrders, initialPurchaseOrder);
      const existing = new Map(merged.map((po) => [po.id, po]));
      prev.forEach((po) => {
        if (po?.id && !existing.has(po.id)) {
          existing.set(po.id, po);
        }
      });
      return Array.from(existing.values());
    });
  }, [purchaseOrders, initialPurchaseOrder]);

  const [poId, setPoId] = useState(() => {
    if (initialPurchaseOrder?.id) return initialPurchaseOrder.id;
    if (initialPurchaseOrderId) return initialPurchaseOrderId;
    return "";
  });

  useEffect(() => {
    if (initialPurchaseOrder?.id) {
      setPoId((prev) => prev || initialPurchaseOrder.id);
    } else if (initialPurchaseOrderId) {
      setPoId((prev) => prev || initialPurchaseOrderId);
    }
  }, [initialPurchaseOrder?.id, initialPurchaseOrderId]);

  const selectedPurchaseOrder = useMemo(
    () => poOptions.find((po) => po.id === poId) || null,
    [poOptions, poId]
  );

  const [poLines, setPoLines] = useState(() =>
    buildPoLineEntries(selectedPurchaseOrder)
  );
  useEffect(() => {
    setPoLines(buildPoLineEntries(selectedPurchaseOrder));
  }, [selectedPurchaseOrder]);

  const [manualLines, setManualLines] = useState([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [error, setError] = useState(null);

  const hasPurchaseOrder = Boolean(poId);

  const addManualLine = useCallback(() => {
    if (!productId || !qty) return;
    const numericQty = Number(qty);
    const numericCost = unitCost ? Number(unitCost) : 0;
    if (!Number.isFinite(numericQty) || numericQty <= 0) return;
    if (!Number.isFinite(numericCost) || numericCost < 0) return;
    setManualLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        productId,
        qtyReceived: numericQty,
        unitCost: numericCost,
      },
    ]);
    setProductId("");
    setQty("");
    setUnitCost("");
  }, [productId, qty, unitCost]);

  const removeManualLine = (id) => {
    setManualLines((prev) => prev.filter((line) => line.id !== id));
  };

  const updatePoLineQty = (lineId, value) => {
    setPoLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, qty: value } : line))
    );
  };

  const updatePoLineCost = (lineId, value) => {
    setPoLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, unitCost: value } : line
      )
    );
  };

  const fillRemainingQty = (lineId) => {
    setPoLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, qty: String(line.remainingQty) } : line
      )
    );
  };

  const resetManualInputs = () => {
    setManualLines([]);
    setProductId("");
    setQty("");
    setUnitCost("");
  };

  const refreshPurchaseOrder = async (id) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setPoOptions((prev) => {
        const exists = prev.some((po) => po.id === data.id);
        if (exists) {
          return prev.map((po) => (po.id === data.id ? data : po));
        }
        return [data, ...prev];
      });
      setPoLines(buildPoLineEntries(data));
    } catch (err) {
      console.warn("Impossible de rafraîchir le bon de commande", err);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSuccessInfo(null);
    setError(null);
    try {
      const payloadLines = hasPurchaseOrder
        ? poLines
            .filter((line) => {
              if (!line.qty) return false;
              const q = Number(line.qty);
              return Number.isFinite(q) && q > 0;
            })
            .map((line) => ({
              productId: line.productId,
              purchaseOrderLineId: line.id,
              qtyReceived: Number(line.qty),
              unitCost: line.unitCost ? Number(line.unitCost) : 0,
              version: line.version != null ? Number(line.version) : undefined,
            }))
        : manualLines.map((line) => ({
            productId: line.productId,
            qtyReceived: line.qtyReceived,
            unitCost: line.unitCost,
          }));

      if (!payloadLines.length) {
        setError(
          hasPurchaseOrder
            ? "Sélectionnez au moins une quantité à réceptionner."
            : "Ajoutez au moins une ligne."
        );
        setSubmitting(false);
        return;
      }

      const body = {
        purchaseOrderId: hasPurchaseOrder ? poId : undefined,
        lines: payloadLines,
      };

      const res = await authorizedFetch("/api/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error || "Erreur lors de la création de la réception."
        );
      }

      setSuccessInfo({
        number: data.number,
        purchaseOrderId: data.purchaseOrderId || body.purchaseOrderId || null,
      });

      if (hasPurchaseOrder) {
        await refreshPurchaseOrder(poId);
      } else {
        resetManualInputs();
      }
    } catch (err) {
      setError(err.message);
      setSuccessInfo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = hasPurchaseOrder
    ? poLines.some((line) => Number(line.qty) > 0)
    : manualLines.length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          Bon de commande (optionnel)
        </label>
        <select
          value={poId}
          onChange={(event) => setPoId(event.target.value)}
          className="mt-1 border rounded px-2 py-1 w-full text-sm"
        >
          <option value="">-- aucun --</option>
          {poOptions.map((po) => (
            <option key={po.id} value={po.id}>
              {po.number}
              {po.supplier?.name ? ` — ${po.supplier.name}` : ""}
            </option>
          ))}
        </select>
        {hasPurchaseOrder && (
          <p className="text-[11px] text-gray-600">
            Les lignes restantes du bon sélectionné apparaissent ci-dessous.
            Renseignez les quantités réellement reçues.
          </p>
        )}
      </div>

      {hasPurchaseOrder ? (
        <section className="space-y-3">
          {poLines.length === 0 ? (
            <div className="text-xs text-green-600 border border-green-200 rounded px-3 py-2 bg-green-50">
              Toutes les lignes de ce bon sont déjà marquées comme reçues.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-1 text-left">Produit</th>
                    <th className="border px-2 py-1 text-right">Commandé</th>
                    <th className="border px-2 py-1 text-right">Déjà reçu</th>
                    <th className="border px-2 py-1 text-right">Reste</th>
                    <th className="border px-2 py-1 text-right">
                      Qté à réceptionner
                    </th>
                    <th className="border px-2 py-1 text-right">
                      Coût unitaire
                    </th>
                    <th className="border px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {poLines.map((line) => (
                    <tr key={line.id}>
                      <td className="border px-2 py-1">{line.productName}</td>
                      <td className="border px-2 py-1 text-right font-mono">
                        {line.orderedQty.toFixed(3)}
                      </td>
                      <td className="border px-2 py-1 text-right font-mono">
                        {line.receivedQty.toFixed(3)}
                      </td>
                      <td className="border px-2 py-1 text-right font-mono">
                        {line.remainingQty.toFixed(3)}
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          max={line.remainingQty}
                          step="0.001"
                          value={line.qty}
                          onChange={(event) =>
                            updatePoLineQty(line.id, event.target.value)
                          }
                          className="w-full border rounded px-1 py-0.5 text-right"
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={line.unitCost}
                          onChange={(event) =>
                            updatePoLineCost(line.id, event.target.value)
                          }
                          className="w-full border rounded px-1 py-0.5 text-right"
                        />
                      </td>
                      <td className="border px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => fillRemainingQty(line.id)}
                          className="text-[11px] text-blue-600 underline"
                        >
                          Tout recevoir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium">Produit ID</label>
              <input
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
                placeholder="productId"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Quantité</label>
              <input
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Coût unitaire</label>
              <input
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
              />
            </div>
            <button
              type="button"
              onClick={addManualLine}
              className="bg-blue-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
              disabled={!productId || !qty}
            >
              Ajouter
            </button>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-1">Lignes en attente</h4>
            <ul className="space-y-1 text-xs">
              {manualLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between border rounded px-2 py-1"
                >
                  <span>
                    {line.productId} : {line.qtyReceived} @ {line.unitCost}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeManualLine(line.id)}
                    className="text-red-600"
                  >
                    x
                  </button>
                </li>
              ))}
              {!manualLines.length && (
                <li className="text-slate-500 italic">Aucune ligne</li>
              )}
            </ul>
          </div>
        </section>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {submitting ? "En cours…" : "Créer réception"}
        </button>
        {error && <div className="text-xs text-red-600">{error}</div>}
        {successInfo && !error && (
          <div
            className="flex flex-col gap-2 text-xs text-green-700 border border-green-200 bg-green-50 rounded px-3 py-2"
            data-testid="message"
          >
            <div>
              Réception créée&nbsp;
              <span className="font-semibold">{successInfo.number}</span>.
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setSuccessInfo(null)}
                className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
              >
                Continuer la réception
              </button>
              <Link
                href="/purchase-orders"
                className="px-2 py-1 rounded border border-green-500 text-green-700 hover:bg-green-100"
              >
                Retour aux bons de commande
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
