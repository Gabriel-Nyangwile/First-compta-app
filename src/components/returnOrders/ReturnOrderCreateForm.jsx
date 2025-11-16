"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function format(number, digits = 3) {
  const value = Number(number);
  if (!Number.isFinite(value)) return "";
  return value.toFixed(digits);
}

export default function ReturnOrderCreateForm({ goodsReceipt }) {
  const [lines, setLines] = useState(() => {
    return (goodsReceipt?.lines || []).map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.product?.name || line.productId,
      available: Number(line.availableForReturn || 0),
      unitCost: Number(line.unitCostNumber ?? line.unitCost ?? 0),
      quantity: "",
      reason: "",
    }));
  });
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const [success, setSuccess] = useState(null);

  const supplierId = goodsReceipt?.supplier?.id;

  const hasReturnable = useMemo(
    () => lines.some((line) => line.available > 1e-6),
    [lines]
  );
  const hasSelected = useMemo(
    () =>
      lines.some(
        (line) =>
          Number(line.quantity) > 0 &&
          Number(line.quantity) <= line.available + 1e-6
      ),
    [lines]
  );

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const qty = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        if (!Number.isFinite(qty) || qty <= 0) {
          return acc;
        }
        acc.quantity += qty;
        acc.amount += qty * (Number.isFinite(unitCost) ? unitCost : 0);
        return acc;
      },
      { quantity: 0, amount: 0 }
    );
  }, [lines]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  function updateLine(lineId, field, value) {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: value,
            }
          : line
      )
    );
  }

  async function submit() {
    if (!supplierId) {
      setError(
        "La réception n'est rattachée à aucun fournisseur, impossible de créer un retour."
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const payloadLines = lines
        .map((line) => {
          const qty = Number(line.quantity);
          if (!Number.isFinite(qty) || qty <= 0) return null;
          if (qty > line.available + 1e-6) {
            throw new Error(
              `Quantité à retourner supérieure au disponible pour ${line.productName}`
            );
          }
          const entry = {
            goodsReceiptLineId: line.id,
            quantity: qty,
            unitCost: Number(line.unitCost),
          };
          if (line.reason?.trim()) entry.reason = line.reason.trim();
          return entry;
        })
        .filter(Boolean);

      if (!payloadLines.length) {
        setError(
          "Sélectionnez au moins une ligne avec une quantité à retourner."
        );
        setSubmitting(false);
        return;
      }

      const body = {
        supplierId,
        purchaseOrderId: goodsReceipt?.purchaseOrder?.id || undefined,
        goodsReceiptId: goodsReceipt.id,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: payloadLines,
      };

      const res = await fetch("/api/return-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.error || "Erreur création retour fournisseur");
      setSuccess(data);
      if (data?.id) {
        router.push(`/return-orders/${data.id}`);
        return;
      }
      setLines((prev) =>
        prev.map((line) => ({
          ...line,
          quantity: "",
          reason: "",
        }))
      );
      setReason("");
      setNotes("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasReturnable) {
    return (
      <div className="px-3 py-2 border border-dashed rounded text-sm text-slate-500">
        Aucun article rangé disponible pour un retour fournisseur.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <table className="min-w-full border text-[12px]">
        <thead className="bg-amber-50 text-amber-800">
          <tr>
            <th className="border px-2 py-1 text-left">Produit</th>
            <th className="border px-2 py-1 text-right">Dispo</th>
            <th className="border px-2 py-1 text-right">Qté retour</th>
            <th className="border px-2 py-1 text-right">Coût</th>
            <th className="border px-2 py-1 text-left">Motif</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="border px-2 py-1">
                <div className="flex flex-col">
                  <span>{line.productName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {line.id.slice(0, 8)}
                  </span>
                </div>
              </td>
              <td className="border px-2 py-1 text-right font-mono">
                {format(line.available)}
              </td>
              <td className="border px-2 py-1">
                <input
                  type="number"
                  min="0"
                  max={line.available}
                  step="0.001"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(line.id, "quantity", event.target.value)
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
                    updateLine(line.id, "unitCost", event.target.value)
                  }
                  className="w-full border rounded px-1 py-0.5 text-right"
                />
              </td>
              <td className="border px-2 py-1">
                <input
                  type="text"
                  value={line.reason}
                  onChange={(event) =>
                    updateLine(line.id, "reason", event.target.value)
                  }
                  className="w-full border rounded px-1 py-0.5"
                  placeholder="Motif (optionnel)"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <label className="space-y-1">
          <span className="text-[11px] uppercase text-amber-800">
            Motif global
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="border rounded px-2 py-1"
            rows={3}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] uppercase text-amber-800">
            Notes internes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="border rounded px-2 py-1"
            rows={3}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded border border-amber-100 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
        <span>
          Total sélectionné&nbsp;:
          <strong className="ml-1 font-semibold">
            {totals.quantity.toFixed(3)} u
          </strong>
        </span>
        <span>
          Valorisation retour&nbsp;:
          <strong className="ml-1 font-semibold">
            {totals.amount.toFixed(2)} €
          </strong>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !hasSelected}
          className="px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          {submitting ? "Création…" : "Créer le retour fournisseur"}
        </button>
        {error && <span className="text-rose-600 text-[12px]">{error}</span>}
        {success && (
          <span className="text-emerald-600 text-[12px]">
            Retour {success.number || success.id} créé. Actualisez la page pour
            visualiser les dernières informations.
          </span>
        )}
      </div>
    </div>
  );
}
