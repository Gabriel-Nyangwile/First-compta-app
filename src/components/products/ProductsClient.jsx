"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import AccountAutocomplete from "../AccountAutocomplete";
import { authorizedFetch } from "@/lib/apiClient";

const STOCK_NATURE_LABELS = {
  PURCHASED: "Marchandises achetées (603)",
  PRODUCED: "Production vendue (701)",
};

const INVENTORY_PREFIX = "31";

const variationPrefix = (nature) => (nature === "PRODUCED" ? "701" : "603");

const emptyCreateForm = {
  sku: "",
  name: "",
  description: "",
  unit: "PCS",
  stockNature: "PURCHASED",
  inventoryAccount: null,
  stockVariationAccount: null,
};

const emptyConfigForm = {
  stockNature: "PURCHASED",
  inventoryAccount: null,
  stockVariationAccount: null,
};

function formatAccount(account) {
  if (!account?.number) return "-";
  return (
    <div className="flex flex-col">
      <span className="font-mono text-xs text-slate-700">{account.number}</span>
      {account.label && (
        <span className="text-[11px] text-slate-500 break-words">
          {account.label}
        </span>
      )}
    </div>
  );
}

function formatCsvValue(value) {
  if (value == null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

export default function ProductsClient({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ...emptyCreateForm });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [confirm, setConfirm] = useState(null); // { id, sku }
  const [filter, setFilter] = useState("");
  const [filtered, setFiltered] = useState(initialProducts || []);
  const [configProduct, setConfigProduct] = useState(null);
  const [configForm, setConfigForm] = useState({ ...emptyConfigForm });
  const [configError, setConfigError] = useState("");
  const [configLoading, setConfigLoading] = useState(false);

  useEffect(() => {
    const f = filter.trim().toLowerCase();
    if (!f) setFiltered(products);
    else
      setFiltered(
        products.filter(
          (p) =>
            p.name.toLowerCase().includes(f) ||
            p.sku.toLowerCase().includes(f) ||
            p.inventoryAccount?.number?.toLowerCase().includes(f) ||
            p.stockVariationAccount?.number?.toLowerCase().includes(f)
        )
      );
  }, [products, filter]);

  function resetForm() {
    setForm({ ...emptyCreateForm });
    setError("");
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
    setTimeout(() => {
      const inp = document.getElementById("new-prod-sku");
      if (inp) inp.focus();
    }, 30);
  }

  function toast(msg) {
    setInfo(msg);
    setTimeout(() => setInfo(""), 4000);
  }

  function handleExportCsv() {
    const headers = [
      "SKU",
      "Nom",
      "Nature",
      "Compte stock",
      "Compte variation",
      "Stock",
      "Cout moyen",
      "Actif",
    ];
    const rows = filtered.map((product) => {
      const nature =
        STOCK_NATURE_LABELS[product.stockNature] || product.stockNature || "";
      const inventoryAccount =
        product.inventoryAccount?.number ||
        product.inventoryAccount?.label ||
        "";
      const variationAccount =
        product.stockVariationAccount?.number ||
        product.stockVariationAccount?.label ||
        "";
      const qty = Number(product.qtyOnHand || 0).toFixed(3);
      const avgCost =
        product.avgCost != null ? Number(product.avgCost).toFixed(4) : "";
      const active = product.isActive ? "Oui" : "Non";
      return [
        product.sku,
        product.name,
        nature,
        inventoryAccount,
        variationAccount,
        qty,
        avgCost,
        active,
      ];
    });

    const csv = [
      headers.map(formatCsvValue).join(";"),
      ...rows.map((row) => row.map(formatCsvValue).join(";")),
    ].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `produits-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleCreateNatureChange(value) {
    setForm((prev) => {
      const next = { ...prev, stockNature: value };
      if (
        prev.stockVariationAccount &&
        !prev.stockVariationAccount.number?.startsWith(variationPrefix(value))
      ) {
        next.stockVariationAccount = null;
      }
      return next;
    });
  }

  function handleConfigNatureChange(value) {
    setConfigForm((prev) => {
      const next = { ...prev, stockNature: value };
      if (
        prev.stockVariationAccount &&
        !prev.stockVariationAccount.number?.startsWith(variationPrefix(value))
      ) {
        next.stockVariationAccount = null;
      }
      return next;
    });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.sku.trim() || !form.name.trim()) {
      setError("SKU et Nom requis");
      return;
    }
    if (!form.inventoryAccount || !form.stockVariationAccount) {
      setError("Sélectionnez les comptes 31x et 603/701.");
      return;
    }
    setLoading(true);
    try {
      const res = await authorizedFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku.trim(),
          name: form.name.trim(),
          description: form.description || undefined,
          unit: form.unit || "PCS",
          stockNature: form.stockNature,
          inventoryAccountId: form.inventoryAccount.id,
          stockVariationAccountId: form.stockVariationAccount.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur création");
      } else {
        setProducts((list) => [
          {
            ...data,
            qtyOnHand: "0",
            avgCost: null,
          },
          ...list,
        ]);
        setModalOpen(false);
        toast(`Produit ${data.sku} créé`);
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(prod) {
    try {
      const res = await authorizedFetch(`/api/products/${prod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !prod.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Erreur MAJ");
        return;
      }
      setProducts((list) =>
        list.map((p) => (p.id === prod.id ? { ...p, ...data } : p))
      );
    } catch {
      toast("Erreur réseau");
    }
  }

  async function deleteProduct(id) {
    try {
      const res = await authorizedFetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Suppression impossible");
        return;
      }
      setProducts((list) => list.filter((p) => p.id !== id));
      toast("Produit supprimé");
    } catch {
      toast("Erreur réseau");
    }
  }

  function openConfig(product) {
    setConfigProduct(product);
    setConfigForm({
      stockNature: product.stockNature || "PURCHASED",
      inventoryAccount: product.inventoryAccount || null,
      stockVariationAccount: product.stockVariationAccount || null,
    });
    setConfigError("");
    setConfigLoading(false);
  }

  function closeConfig() {
    setConfigProduct(null);
    setConfigForm({ ...emptyConfigForm });
    setConfigError("");
    setConfigLoading(false);
  }

  async function handleConfigSubmit(e) {
    e.preventDefault();
    if (!configProduct) return;
    if (!configForm.inventoryAccount || !configForm.stockVariationAccount) {
      setConfigError("Sélectionnez les deux comptes avant de valider.");
      return;
    }
    setConfigLoading(true);
    try {
      const res = await authorizedFetch(`/api/products/${configProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockNature: configForm.stockNature,
          inventoryAccountId: configForm.inventoryAccount.id,
          stockVariationAccountId: configForm.stockVariationAccount.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConfigError(data.error || "Erreur mise à jour");
      } else {
        setProducts((list) =>
          list.map((p) => (p.id === configProduct.id ? { ...p, ...data } : p))
        );
        toast(`Configuration comptable mise à jour (${data.sku})`);
        closeConfig();
      }
    } catch {
      setConfigError("Erreur réseau");
    } finally {
      setConfigLoading(false);
    }
  }

  const ledgerConfigured = (product) =>
    !!product.inventoryAccount?.id && !!product.stockVariationAccount?.id;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Produits</h1>
        <div className="flex gap-2 items-center">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer (nom, SKU ou compte)"
            className="border px-2 py-1 rounded text-sm"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded text-sm hover:bg-slate-300"
          >
            Export CSV
          </button>
          <button
            onClick={openModal}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
          >
            Nouveau produit
          </button>
          <Link
            href="/purchase-orders/create"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Créer BC
          </Link>
        </div>
      </div>
      {info && (
        <div className="mb-4 text-xs px-3 py-2 rounded bg-slate-800 text-white inline-block">
          {info}
        </div>
      )}
      <div className="overflow-x-auto border rounded bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-2">SKU</th>
              <th className="p-2">Nom</th>
              <th className="p-2">Nature</th>
              <th className="p-2">Compte stock (31x)</th>
              <th className="p-2">Compte variation (603/701)</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-right">Coût moyen</th>
              <th className="p-2">Actif</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-500">
                  Aucun produit
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{p.sku}</td>
                <td className="p-2">{p.name}</td>
                <td className="p-2">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700">
                    {STOCK_NATURE_LABELS[p.stockNature] || p.stockNature || "—"}
                  </span>
                </td>
                <td
                  className={`p-2 align-top ${
                    p.inventoryAccount ? "" : "text-amber-600"
                  }`}
                >
                  {formatAccount(p.inventoryAccount)}
                </td>
                <td
                  className={`p-2 align-top ${
                    p.stockVariationAccount ? "" : "text-amber-600"
                  }`}
                >
                  {formatAccount(p.stockVariationAccount)}
                </td>
                <td className="p-2 text-right">
                  {Number(p.qtyOnHand || 0).toFixed(3)}
                </td>
                <td className="p-2 text-right">
                  {p.avgCost != null ? Number(p.avgCost).toFixed(4) : "—"}
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                        p.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {p.isActive ? "Actif" : "Inactif"}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                        ledgerConfigured(p)
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ledgerConfigured(p) ? "Comptes prêts" : "À configurer"}
                    </span>
                  </div>
                </td>
                <td className="p-2 text-right space-x-2 whitespace-nowrap">
                  <Link
                    href={`/products/${p.id}`}
                    className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Historique
                  </Link>
                  <button
                    onClick={() => openConfig(p)}
                    className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  >
                    Configurer
                  </button>
                  <button
                    onClick={() => toggleActive(p)}
                    className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300"
                  >
                    {p.isActive ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    onClick={() => setConfirm({ id: p.id, sku: p.sku })}
                    className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>
          Configurez les comptes 31x et 603/701 pour que les mises en stock
          génèrent automatiquement les écritures de variation.
        </p>
        <p>
          La suppression échouera si le produit est référencé (commandes,
          réceptions, factures). Dans ce cas désactivez-le.
        </p>
      </div>
      <div className="mt-4">
        <Link href="/" className="text-blue-600 underline text-sm">
          Retour Accueil
        </Link>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 overflow-auto">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Nouveau produit</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-xs text-slate-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs space-y-1">
                  <span className="font-medium">SKU *</span>
                  <input
                    id="new-prod-sku"
                    value={form.sku}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sku: e.target.value }))
                    }
                    className="border px-2 py-1 rounded text-xs w-full"
                    required
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="font-medium">Nom *</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="border px-2 py-1 rounded text-xs w-full"
                    required
                  />
                </label>
              </div>
              <label className="text-xs space-y-1 block">
                <span className="font-medium">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className="border px-2 py-1 rounded text-xs w-full"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs space-y-1">
                  <span className="font-medium">Unité</span>
                  <input
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="border px-2 py-1 rounded text-xs w-full"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="font-medium">Nature *</span>
                  <select
                    value={form.stockNature}
                    onChange={(e) => handleCreateNatureChange(e.target.value)}
                    className="border px-2 py-1 rounded text-xs w-full"
                  >
                    <option value="PURCHASED">
                      Marchandises achetées (603)
                    </option>
                    <option value="PRODUCED">Production vendue (701)</option>
                  </select>
                </label>
              </div>
              <div className="space-y-3">
                <label className="text-xs space-y-1 block">
                  <span className="font-medium">Compte stock 31x *</span>
                  <AccountAutocomplete
                    key={`create-inventory-${form.inventoryAccount?.id || ""}`}
                    value={form.inventoryAccount}
                    onChange={(acc) =>
                      setForm((f) => ({ ...f, inventoryAccount: acc }))
                    }
                    filterPrefix={INVENTORY_PREFIX}
                  />
                </label>
                <label className="text-xs space-y-1 block">
                  <span className="font-medium">
                    Compte variation {variationPrefix(form.stockNature)} *
                  </span>
                  <AccountAutocomplete
                    key={`create-variation-${
                      form.stockVariationAccount?.id || ""
                    }`}
                    value={form.stockVariationAccount}
                    onChange={(acc) =>
                      setForm((f) => ({ ...f, stockVariationAccount: acc }))
                    }
                    filterPrefix={variationPrefix(form.stockNature)}
                  />
                </label>
              </div>
              {error && <div className="text-xs text-red-600">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1 text-xs bg-gray-200 rounded"
                >
                  Annuler
                </button>
                <button
                  disabled={loading}
                  className="px-4 py-1 text-xs bg-emerald-600 text-white rounded disabled:opacity-50"
                >
                  {loading ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {configProduct && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 overflow-auto">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">
                Configuration comptable — {configProduct.sku}
              </h2>
              <button
                onClick={closeConfig}
                className="text-xs text-slate-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs space-y-1">
                  <span className="font-medium">Nature *</span>
                  <select
                    value={configForm.stockNature}
                    onChange={(e) => handleConfigNatureChange(e.target.value)}
                    className="border px-2 py-1 rounded text-xs w-full"
                  >
                    <option value="PURCHASED">
                      Marchandises achetées (603)
                    </option>
                    <option value="PRODUCED">Production vendue (701)</option>
                  </select>
                </label>
                <div className="text-xs text-slate-500">
                  <span>
                    Compte 603 pour les marchandises, 701 pour la production.
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs space-y-1 block">
                  <span className="font-medium">Compte stock 31x *</span>
                  <AccountAutocomplete
                    key={`config-inventory-${configProduct.id}`}
                    value={configForm.inventoryAccount}
                    onChange={(acc) =>
                      setConfigForm((f) => ({ ...f, inventoryAccount: acc }))
                    }
                    filterPrefix={INVENTORY_PREFIX}
                  />
                </label>
                <label className="text-xs space-y-1 block">
                  <span className="font-medium">
                    Compte variation {variationPrefix(configForm.stockNature)} *
                  </span>
                  <AccountAutocomplete
                    key={`config-variation-${configProduct.id}`}
                    value={configForm.stockVariationAccount}
                    onChange={(acc) =>
                      setConfigForm((f) => ({
                        ...f,
                        stockVariationAccount: acc,
                      }))
                    }
                    filterPrefix={variationPrefix(configForm.stockNature)}
                  />
                </label>
              </div>
              {configError && (
                <div className="text-xs text-red-600">{configError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeConfig}
                  className="px-3 py-1 text-xs bg-gray-200 rounded"
                >
                  Annuler
                </button>
                <button
                  disabled={configLoading}
                  className="px-4 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
                >
                  {configLoading ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white rounded shadow p-5 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold">Confirmer suppression</h3>
            <p className="text-xs">
              Supprimer le produit{" "}
              <span className="font-mono">{confirm.sku}</span>? Cette action
              échouera si le produit est déjà utilisé.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-3 py-1 text-xs bg-gray-200 rounded"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  deleteProduct(confirm.id);
                  setConfirm(null);
                }}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
