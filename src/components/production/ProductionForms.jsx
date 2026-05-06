"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function postJson(url, payload = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function BomCreateForm({ products }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState([{ componentProductId: "", quantity: "1", lossRate: "0" }]);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      label: form.get("label"),
      productId: form.get("productId"),
      version: Number(form.get("version") || 1),
      notes: form.get("notes"),
      lines: lines
        .filter((line) => line.componentProductId && Number(line.quantity) > 0)
        .map((line) => ({
          componentProductId: line.componentProductId,
          quantity: Number(line.quantity),
          lossRate: Number(line.lossRate || 0),
        })),
    };
    const res = await postJson("/api/production/boms", payload);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Erreur création nomenclature.");
      return;
    }
    router.push(`/production/boms?created=${data.bom?.id || "1"}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border bg-white p-4">
      {message && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Produit fini</span>
          <select name="productId" required className="w-full rounded border px-2 py-1">
            <option value="">Sélectionner</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} - {product.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-1">
          <span className="font-medium">Libellé</span>
          <input name="label" required className="w-full rounded border px-2 py-1" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Version</span>
          <input name="version" type="number" min="1" defaultValue="1" className="w-full rounded border px-2 py-1" />
        </label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Composants</h2>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, { componentProductId: "", quantity: "1", lossRate: "0" }])}
            className="rounded border px-2 py-1 text-xs text-slate-700"
          >
            Ajouter une ligne
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 rounded border bg-slate-50 p-2 md:grid-cols-[1fr_120px_120px_80px]">
              <select
                value={line.componentProductId}
                required
                onChange={(event) =>
                  setLines((current) => current.map((item, i) => (i === index ? { ...item, componentProductId: event.target.value } : item)))
                }
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">Composant</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={line.quantity}
                onChange={(event) =>
                  setLines((current) => current.map((item, i) => (i === index ? { ...item, quantity: event.target.value } : item)))
                }
                className="rounded border px-2 py-1 text-sm"
                placeholder="Qté"
              />
              <input
                type="number"
                step="0.0001"
                min="0"
                max="0.9999"
                value={line.lossRate}
                onChange={(event) =>
                  setLines((current) => current.map((item, i) => (i === index ? { ...item, lossRate: event.target.value } : item)))
                }
                className="rounded border px-2 py-1 text-sm"
                placeholder="Perte"
              />
              <button
                type="button"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                disabled={lines.length === 1}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Notes</span>
        <textarea name="notes" rows={3} className="w-full rounded border px-2 py-1" />
      </label>
      <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
        Créer la nomenclature
      </button>
    </form>
  );
}

export function BomRowActions({ bom }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    const res = await postJson(`/api/production/boms/${bom.id}/${action}`, {});
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Action impossible.");
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2">
      {bom.status !== "ACTIVE" && (
        <button disabled={busy} onClick={() => run("activate")} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50">
          Activer
        </button>
      )}
      {bom.status !== "ARCHIVED" && (
        <button disabled={busy} onClick={() => run("archive")} className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50">
          Archiver
        </button>
      )}
    </div>
  );
}

export function OrderCreateForm({ boms, accounts }) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      billOfMaterialId: form.get("billOfMaterialId"),
      plannedQty: Number(form.get("plannedQty")),
      plannedDate: form.get("plannedDate") || null,
      wipAccountId: form.get("wipAccountId"),
      notes: form.get("notes"),
    };
    const res = await postJson("/api/production/orders", payload);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Erreur création ordre.");
      return;
    }
    router.push(`/production/orders/${data.order.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border bg-white p-4">
      {message && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nomenclature active</span>
          <select name="billOfMaterialId" required className="w-full rounded border px-2 py-1">
            <option value="">Sélectionner</option>
            {boms.map((bom) => (
              <option key={bom.id} value={bom.id}>
                {bom.code} - {bom.product?.sku} {bom.product?.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Compte production en cours</span>
          <select name="wipAccountId" required className="w-full rounded border px-2 py-1">
            <option value="">Sélectionner</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.number} - {account.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Quantité à produire</span>
          <input name="plannedQty" type="number" step="0.001" min="0.001" required defaultValue="1" className="w-full rounded border px-2 py-1" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Date prévue</span>
          <input name="plannedDate" type="date" className="w-full rounded border px-2 py-1" />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Note de fabrication</span>
        <textarea name="notes" rows={3} className="w-full rounded border px-2 py-1" />
      </label>
      <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
        Créer l'ordre de fabrication
      </button>
    </form>
  );
}

export function ProductionOrderActions({ order }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [producedQty, setProducedQty] = useState(order.plannedQty || 1);
  const [scrapQty, setScrapQty] = useState(0);

  const remainingComponents = useMemo(
    () =>
      (order.components || []).map((component) => ({
        ...component,
        remainingQty: Number(component.plannedQty || 0) - Number(component.consumedQty || 0),
      })),
    [order.components]
  );

  async function run(action, payload = {}) {
    setBusy(action);
    setMessage("");
    const res = await postJson(`/api/production/orders/${order.id}/${action}`, payload);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Action impossible.");
    } else {
      router.refresh();
    }
    setBusy("");
  }

  return (
    <div className="space-y-3 rounded border bg-white p-4">
      {message && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>}
      <div className="flex flex-wrap gap-2">
        {order.status === "DRAFT" && (
          <button disabled={!!busy} onClick={() => run("release")} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            Lancer l'ordre
          </button>
        )}
        {["DRAFT", "RELEASED"].includes(order.status) && (
          <button disabled={!!busy} onClick={() => run("cancel")} className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">
            Annuler
          </button>
        )}
        {["RELEASED", "IN_PROGRESS"].includes(order.status) && (
          <button disabled={!!busy} onClick={() => run("consume", {})} className="rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-50">
            Consommer les composants
          </button>
        )}
        {order.status === "COMPLETED" && (
          <button disabled={!!busy} onClick={() => run("close")} className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50">
            Clôturer
          </button>
        )}
      </div>
      {order.status === "IN_PROGRESS" && (
        <div className="grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-[160px_160px_auto]">
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={producedQty}
            onChange={(event) => setProducedQty(event.target.value)}
            className="rounded border px-2 py-1 text-sm"
            aria-label="Quantité produite"
          />
          <input
            type="number"
            step="0.001"
            min="0"
            value={scrapQty}
            onChange={(event) => setScrapQty(event.target.value)}
            className="rounded border px-2 py-1 text-sm"
            aria-label="Quantité rebutée"
          />
          <button
            disabled={!!busy}
            onClick={() => run("complete", { quantity: Number(producedQty), scrapQty: Number(scrapQty) })}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Déclarer la production
          </button>
        </div>
      )}
      {["RELEASED", "IN_PROGRESS"].includes(order.status) && (
        <div className="text-xs text-slate-600">
          La consommation automatique prélève toutes les quantités restantes prévues par la nomenclature.
          {remainingComponents.some((component) => component.remainingQty <= 0) && " Certains composants sont déjà totalement consommés."}
        </div>
      )}
    </div>
  );
}
