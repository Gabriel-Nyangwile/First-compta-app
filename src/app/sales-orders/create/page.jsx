// Saisie d'une commande client (Sales Order)
"use client";
import { useState, useEffect, useMemo } from "react";
import ClientAutocomplete from "@/components/ClientAutocomplete";
import ProductAutocomplete from "@/components/ProductAutocomplete";
import AccountAutocomplete from "@/components/AccountAutocomplete";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EMPTY_LINE = {
  productId: "",
  quantityOrdered: "",
  unitPrice: "",
  vatRate: "",
  accountId: "",
  _account: null,
};

export default function CreateSalesOrderPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expectedShipDate, setExpectedShipDate] = useState("");
  const [lines, setLines] = useState([EMPTY_LINE]);
  const [notes, setNotes] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [products, setProducts] = useState([]);
  // Comptes (placeholder)
  // Charger les produits en stock (qtyOnHand > 0)
  useEffect(() => {
    async function loadProducts() {
      const res = await fetch("/api/products?active=1");
      const data = await res.json();
      // Pour chaque produit, charger qtyOnHand
      const enriched = await Promise.all(
        (data || []).map(async (p) => {
          const invRes = await fetch(`/api/inventory/${p.id}`);
          const invData = await invRes.json();
          return {
            ...p,
            qtyOnHand: invData?.inventory?.qtyOnHand || "0",
            avgCost: invData?.inventory?.avgCost || 0,
          };
        })
      );
      setProducts(enriched.filter((p) => Number(p.qtyOnHand) > 0));
    }
    loadProducts();
  }, []);

  const productMap = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  function handleLineChange(idx, field, value) {
    setLines((lines) =>
      lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  }
  function handleProductSelect(idx, product) {
    setLines((prev) =>
      prev.map((line, lineIdx) =>
        lineIdx === idx
          ? {
              ...line,
              productId: product?.id || "",
              _account: line._account,
            }
          : line
      )
    );
  }

  function handleAccountChange(idx, account) {
    setLines((prev) =>
      prev.map((line, lineIdx) =>
        lineIdx === idx
          ? {
              ...line,
              accountId: account?.id || "",
              _account: account || null,
            }
          : line
      )
    );
  }

  function addLine() {
    setLines((lines) => [...lines, { ...EMPTY_LINE }]);
  }
  function removeLine(idx) {
    setLines((lines) => lines.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setClientId("");
    setIssueDate("");
    setExpectedShipDate("");
    setLines([{ ...EMPTY_LINE }]);
    setNotes("");
    setCustomerReference("");
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        if (!line.productId) continue;
        const product = productMap.get(line.productId);
        if (!product) continue;
        const qtyRequested = Number(line.quantityOrdered || 0);
        const qtyAvailable = Number(product.qtyOnHand || 0);
        if (
          Number.isFinite(qtyRequested) &&
          Number.isFinite(qtyAvailable) &&
          qtyRequested > qtyAvailable + 1e-6
        ) {
          setError(
            `Ligne ${idx + 1}: quantité demandée (${qtyRequested}) supérieure au stock disponible (${qtyAvailable}).`
          );
          setLoading(false);
          return;
        }
      }

      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        if (!line.accountId) {
          setError(`Ligne ${idx + 1}: compte comptable requis.`);
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          issueDate,
          expectedShipDate,
          notes,
          customerReference,
          lines,
        }),
      });
      if (res.ok) {
        setSuccess("Commande enregistrée !");
        setTimeout(() => router.push("/sales-orders"), 1200);
      } else {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Erreur lors de la création.");
      }
    } catch {
      setError("Erreur réseau ou serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8 bg-white rounded shadow mt-8">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors"
        >
          &larr; Retour
        </button>
        <Link
          href="/sales-orders"
          className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors"
        >
          Liste des commandes
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-6">Nouvelle commande client</h1>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {success && <div className="mb-4 text-green-600">{success}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Client</label>
          <ClientAutocomplete
            value={clientId ? { id: clientId } : null}
            onChange={(client) => setClientId(client?.id || "")}
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium">Date commande</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
              className="mt-1 block w-full border rounded px-2 py-1"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium">
              Date livraison prévue
            </label>
            <input
              type="date"
              value={expectedShipDate}
              onChange={(e) => setExpectedShipDate(e.target.value)}
              className="mt-1 block w-full border rounded px-2 py-1"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Référence client</label>
          <input
            type="text"
            value={customerReference}
            onChange={(e) => setCustomerReference(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Lignes de commande
          </label>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <div className="w-64">
                  <ProductAutocomplete
                    value={
                      line.productId
                        ? products.find((p) => p.id === line.productId)
                        : null
                    }
                    onChange={(product) => handleProductSelect(idx, product)}
                    products={products}
                  />
                  {line.productId && (
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-3">
                      <span>
                        Stock{" "}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100">
                          {productMap.get(line.productId)?.qtyOnHand ?? "0"}
                        </span>
                      </span>
                      <span>
                        CUMP{" "}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100">
                          {Number(
                            productMap.get(line.productId)?.avgCost ?? 0
                          ).toFixed(2)}{" "}
                          €
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantityOrdered}
                  onChange={(e) =>
                    handleLineChange(idx, "quantityOrdered", e.target.value)
                  }
                  required
                  placeholder="Qté"
                  className="w-20 border rounded px-2 py-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) =>
                    handleLineChange(idx, "unitPrice", e.target.value)
                  }
                  required
                  placeholder="PU"
                  className="w-20 border rounded px-2 py-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.vatRate}
                  onChange={(e) =>
                    handleLineChange(idx, "vatRate", e.target.value)
                  }
                  placeholder="TVA"
                  className="w-16 border rounded px-2 py-1"
                />
                <div className="min-w-[180px]">
                  <AccountAutocomplete
                    value={line._account}
                    onChange={(account) => handleAccountChange(idx, account)}
                    filterPrefix="70"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-red-600 px-2"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="text-xs text-indigo-600 underline"
            >
              + Ajouter ligne
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Enregistrement..." : "Enregistrer la commande"}
        </button>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => router.push("/sales-orders")}
            className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100"
            disabled={loading}
          >
            Retour
          </button>
        </div>
      </form>
    </main>
  );
}
