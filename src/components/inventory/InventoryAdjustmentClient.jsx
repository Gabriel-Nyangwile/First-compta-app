"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProductAutocomplete from "@/components/ProductAutocomplete";
import { authorizedFetch } from "@/lib/apiClient";

function formatQty(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.000";
  return num.toFixed(3);
}

function formatCurrency(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

export default function InventoryAdjustmentClient() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selection, setSelection] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [countedQty, setCountedQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      setProductsLoading(true);
      try {
        const res = await fetch("/api/products?active=1", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Impossible de charger les produits.");
        }
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : data?.products || [];
          setProducts(list);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Erreur chargement produits");
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentQty = useMemo(() => {
    if (inventory?.inventory?.qtyOnHand != null) {
      return Number(inventory.inventory.qtyOnHand);
    }
    if (selection?.qtyOnHand != null) {
      return Number(selection.qtyOnHand);
    }
    return 0;
  }, [inventory, selection]);

  const currentAvgCost = useMemo(() => {
    if (inventory?.inventory?.avgCost != null) {
      return Number(inventory.inventory.avgCost);
    }
    if (selection?.avgCost != null) {
      return Number(selection.avgCost);
    }
    return 0;
  }, [inventory, selection]);

  const deltaQty = useMemo(() => {
    const counted = Number(countedQty);
    if (!Number.isFinite(counted)) return 0;
    return counted - currentQty;
  }, [countedQty, currentQty]);

  const handleInventoryLoad = useCallback(async (product) => {
    if (!product) {
      setSelection(null);
      setInventory(null);
      setCountedQty("");
      setUnitCost("");
      return;
    }
    setError("");
    setMessage("");
    setSelection(product);
    setInventory(null);
    setCountedQty("");
    setUnitCost("");
    setInventoryLoading(true);
    try {
      const res = await fetch(`/api/inventory/${product.id}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Inventaire introuvable pour ce produit.");
      }
      setInventory(data);
      const current = Number(data?.inventory?.qtyOnHand ?? 0);
      setCountedQty(Number.isFinite(current) ? current.toFixed(3) : "0.000");
      const avg = data?.inventory?.avgCost ?? product.avgCost ?? 0;
      if (Number.isFinite(Number(avg))) {
        setUnitCost(Number(avg).toFixed(4));
      } else {
        setUnitCost("");
      }
    } catch (err) {
      setError(err.message || "Erreur chargement inventaire.");
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!selection?.id) {
      setError("Sélectionnez d'abord un produit.");
      return;
    }
    const counted = Number(countedQty);
    if (!Number.isFinite(counted)) {
      setError("Quantité inventoriée invalide.");
      return;
    }
    const delta = counted - currentQty;
    if (Math.abs(delta) < 1e-6) {
      setError("Aucun écart à enregistrer (quantité identique).");
      return;
    }
    const payload = {
      productId: selection.id,
      qty: Number(delta.toFixed(3)),
    };
    if (delta > 0) {
      const uc = unitCost !== "" ? Number(unitCost) : currentAvgCost;
      if (!Number.isFinite(uc) || uc <= 0) {
        setError("Coût unitaire requis pour un ajustement positif.");
        return;
      }
      payload.unitCost = Number(uc.toFixed(4));
    }
    setSubmitting(true);
    try {
      const res = await authorizedFetch("/api/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Échec de l'ajustement.");
      }
      setMessage("Ajustement enregistré.");
      await handleInventoryLoad(selection);
    } catch (err) {
      setError(err.message || "Erreur lors de l'ajustement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    handleInventoryLoad(null);
    setMessage("");
    setError("");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-800">
          Ajustements d&apos;inventaire
        </h1>
        <p className="text-sm text-slate-600">
          Comparez le stock théorique avec le comptage physique, puis enregistrez
          automatiquement l&apos;écart via un mouvement d&apos;ajustement.
        </p>
      </header>

      <section className="bg-white border border-slate-200 rounded px-4 py-4 space-y-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
          <div>
            <span className="block text-[11px] uppercase text-slate-500 tracking-wide mb-1">
              Produit
            </span>
            <ProductAutocomplete
              products={products}
              value={selection}
              onChange={handleInventoryLoad}
            />
            {productsLoading && (
              <p className="text-[11px] text-slate-500 mt-1">
                Chargement des produits...
              </p>
            )}
          </div>
          <div className="grid bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-600">
            <span>
              Stock théorique :{" "}
              <span className="font-mono">
                {formatQty(currentQty)}
              </span>
            </span>
            <span>
              CUMP actuel :{" "}
              <span className="font-mono">
                {formatCurrency(currentAvgCost)} €
              </span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col text-sm">
              <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
                Quantité inventoriée
              </span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={countedQty}
                onChange={(event) => setCountedQty(event.target.value)}
                className="border rounded px-2 py-1 text-sm"
                disabled={inventoryLoading || submitting}
                placeholder="0.000"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
                Écart calculé
              </span>
              <input
                type="text"
                value={formatQty(deltaQty)}
                readOnly
                className="border rounded px-2 py-1 text-sm bg-slate-100"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
                Coût unitaire (si entrée)
              </span>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                className="border rounded px-2 py-1 text-sm"
                disabled={
                  inventoryLoading ||
                  submitting ||
                  deltaQty <= 0 ||
                  selection == null
                }
                placeholder="0.0000"
              />
            </label>
          </div>

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {error}
            </div>
          )}
          {message && (
            <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              {message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting || !selection || inventoryLoading}
            >
              Enregistrer l&apos;ajustement
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-sm px-3 py-2 text-slate-600 hover:text-slate-800"
                disabled={submitting}
                onClick={handleCancel}
              >
                Annuler
              </button>
              <button
                type="button"
                className="text-sm px-3 py-2 text-slate-600 hover:text-slate-800"
                disabled={submitting}
                onClick={() => router.push("/inventory")}
              >
                Retour
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
