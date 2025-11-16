"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProductAutocomplete from "@/components/ProductAutocomplete";
import { TYPE_OPTIONS, TYPE_LABELS } from "./constants";

function generateKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function buildLine(seed = {}) {
  return {
    key: generateKey(),
    productId: seed.productId || "",
    product: seed.product || null,
    quantity:
      seed.quantity != null && seed.quantity !== ""
        ? String(seed.quantity)
        : "",
    notes: seed.notes || "",
    salesOrderLineId: seed.salesOrderLineId || "",
  };
}

function mergeProductOptions(products = [], initialLines = []) {
  const map = new Map(products.map((product) => [product.id, product]));
  for (const line of initialLines) {
    if (line.product && !map.has(line.product.id)) {
      map.set(line.product.id, {
        ...line.product,
        qtyOnHand: line.product.qtyOnHand ?? "0",
        avgCost: line.product.avgCost ?? 0,
      });
    }
  }
  return Array.from(map.values());
}

export default function StockWithdrawalForm({
  initialData = null,
  mode = "create",
  onSuccess,
  onCancel,
}) {
  const router = useRouter();
  const [type, setType] = useState(initialData?.type || "PRODUCTION");
  const [manufacturingOrderRef, setManufacturingOrderRef] = useState(
    initialData?.manufacturingOrderRef || ""
  );
  const [salesOrderRef, setSalesOrderRef] = useState(
    initialData?.salesOrderRef || ""
  );
  const [salesOrders, setSalesOrders] = useState([]);
  const [loadingSalesOrders, setLoadingSalesOrders] = useState(false);
  const [salesOrdersError, setSalesOrdersError] = useState("");
  const [salesOrderDetails, setSalesOrderDetails] = useState(null);
  const [loadingSalesOrderDetails, setLoadingSalesOrderDetails] = useState(false);
  const [salesOrderDetailsError, setSalesOrderDetailsError] = useState("");
  const [requestedById, setRequestedById] = useState(
    initialData?.requestedById || initialData?.requestedBy?.id || ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [lines, setLines] = useState(() => {
    if (initialData?.lines?.length) {
      return initialData.lines.map((line) =>
        buildLine({
          productId: line.productId,
          product: line.product || null,
          quantity: line.quantity,
          notes: line.notes,
          salesOrderLineId: line.salesOrderLineId || "",
        })
      );
    }
    return [buildLine()];
  });
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!initialData) return;
    setType(initialData.type || "PRODUCTION");
    setManufacturingOrderRef(initialData.manufacturingOrderRef || "");
    setSalesOrderRef(initialData.salesOrderRef || "");
    setRequestedById(
      initialData.requestedById || initialData.requestedBy?.id || ""
    );
    setNotes(initialData.notes || "");
    if (initialData.lines?.length) {
      setLines(
        initialData.lines.map((line) =>
          buildLine({
            productId: line.productId,
            product: line.product || null,
            quantity: line.quantity,
            notes: line.notes,
            salesOrderLineId: line.salesOrderLineId || "",
          })
        )
      );
    }
  }, [initialData]);

  useEffect(() => {
    if (type !== "SALE") {
      setSalesOrders([]);
      setSalesOrderDetails(null);
      setSalesOrdersError("");
      setSalesOrderDetailsError("");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    async function loadSalesOrders() {
      setLoadingSalesOrders(true);
      setSalesOrdersError("");
      try {
        const queries = [
          "status=CONFIRMED&remaining=1",
          "status=CONFIRMED",
          "status=DRAFT",
          "status=FULFILLED",
          "",
        ];
        const byId = new Map();

        for (const query of queries) {
          const url = `/api/sales-orders${query ? `?${query}` : ""}`;
          const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(
              payload?.error || "Impossible de charger les commandes clients."
            );
          }
          const data = await response.json();
          const orders = Array.isArray(data) ? data : data?.orders || [];
          for (const order of orders) {
            if (!order?.id || byId.has(order.id)) continue;
            byId.set(order.id, order);
          }
        }

        const statusPriority = {
          CONFIRMED: 0,
          DRAFT: 1,
          FULFILLED: 2,
          CANCELLED: 3,
        };

        const orders = Array.from(byId.values()).sort((a, b) => {
          const left =
            statusPriority[a.status] ?? statusPriority.CONFIRMED ?? Number.MAX_SAFE_INTEGER;
          const right =
            statusPriority[b.status] ?? statusPriority.CONFIRMED ?? Number.MAX_SAFE_INTEGER;
          if (left !== right) return left - right;
          const numA = a.number || "";
          const numB = b.number || "";
          return numA.localeCompare(numB, "fr-FR");
        });

        if (cancelled) return;
        setSalesOrders(orders);
        if (!orders.length) {
          setSalesOrdersError(
            "Aucune commande client disponible. Créez-en une pour continuer."
          );
        } else {
          setSalesOrdersError("");
        }
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setSalesOrdersError(
          err?.message || "Erreur lors du chargement des commandes clients."
        );
      } finally {
        if (!cancelled) {
          setLoadingSalesOrders(false);
        }
      }
    }
    loadSalesOrders();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [type]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadProducts() {
      setLoadingProducts(true);
      try {
        const res = await fetch("/api/products?active=1", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Impossible de charger les produits.");
        }
        const data = await res.json();
        const options = Array.isArray(data) ? data : data?.products || [];
        const enriched = [];
        for (const product of options) {
          try {
            const invRes = await fetch(`/api/inventory/${product.id}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            if (!invRes.ok) {
              enriched.push({
                ...product,
                qtyOnHand: "0",
                avgCost: 0,
              });
              continue;
            }
            const invData = await invRes.json();
            enriched.push({
              ...product,
              qtyOnHand: invData?.inventory?.qtyOnHand || "0",
              avgCost: invData?.inventory?.avgCost || 0,
            });
          } catch {
            enriched.push({
              ...product,
              qtyOnHand: "0",
              avgCost: 0,
            });
          }
          if (cancelled) break;
        }
        if (!cancelled) {
          setProducts(enriched);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Erreur chargement produits", err);
        }
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const productOptions = useMemo(
    () => mergeProductOptions(products, lines),
    [products, lines]
  );
  const inventoryProductMap = useMemo(() => {
    const map = new Map();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);
  const productMap = useMemo(() => {
    const map = new Map();
    for (const product of productOptions) {
      map.set(product.id, product);
    }
    return map;
  }, [productOptions]);

  const fallbackSalesOrder = useMemo(() => {
    if (!initialData?.lines || !salesOrderRef) return null;
    for (const line of initialData.lines) {
      const salesOrder = line?.salesOrderLine?.salesOrder;
      if (salesOrder && salesOrder.number === salesOrderRef) {
        return {
          id: salesOrder.id,
          number: salesOrder.number,
          status: salesOrder.status,
        };
      }
    }
    return null;
  }, [initialData, salesOrderRef]);

  const salesOrderOptions = useMemo(() => {
    const options = salesOrders.map((order) => ({
      value: order?.number || "",
      label: `${order?.number || "Sans numero"} - ${
        order?.client?.name || "Client inconnu"
      }`,
    }));
    if (
      type === "SALE" &&
      salesOrderRef &&
      !options.some((option) => option.value === salesOrderRef)
    ) {
      options.unshift({
        value: salesOrderRef,
        label: `${salesOrderRef} - Reference existante`,
      });
    }
    return options;
  }, [salesOrders, salesOrderRef, type]);

  const selectedSalesOrder = useMemo(() => {
    if (!salesOrderRef) return null;
    const found = salesOrders.find((order) => order?.number === salesOrderRef);
    if (found) return found;
    return fallbackSalesOrder;
  }, [salesOrderRef, salesOrders, fallbackSalesOrder]);
  const selectedSalesOrderId = selectedSalesOrder?.id || "";
  const selectedClientName =
    selectedSalesOrder?.client?.name ||
    salesOrderDetails?.client?.name ||
    "Inconnu";
  const salesOrderLineMap = useMemo(() => {
    if (!salesOrderDetails?.lines) return new Map();
    const map = new Map();
    for (const line of salesOrderDetails.lines) {
      const ordered = Number(line.quantityOrdered ?? 0);
      const allocated = Number(line.quantityAllocated ?? 0);
      const shipped = Number(line.quantityShipped ?? 0);
      const remaining = Math.max(0, ordered - allocated - shipped);
      map.set(line.id, { ...line, remaining });
    }
    return map;
  }, [salesOrderDetails]);
  const salesOrderLineOptions = useMemo(() => {
    return Array.from(salesOrderLineMap.values()).map((line) => {
      const productLabel = line.product?.sku
        ? `${line.product.sku} • ${line.product.name}`
        : line.product?.name || "Produit";
      return {
        value: line.id,
        label: `${productLabel} — restant ${line.remaining.toFixed(3)}`,
        remaining: line.remaining,
        product: line.product,
        disabled: line.remaining <= 1e-6,
      };
    });
  }, [salesOrderLineMap]);
  const resolveProductById = useCallback(
    (productId, fallbackProduct = null) => {
      if (!productId) return fallbackProduct ? { ...fallbackProduct } : null;
      const inventoryProduct = inventoryProductMap.get(productId);
      const merged = {
        ...(fallbackProduct || {}),
        ...(inventoryProduct || {}),
      };
      if (!merged.id) merged.id = productId;
      merged.qtyOnHand =
        inventoryProduct?.qtyOnHand ?? fallbackProduct?.qtyOnHand ?? "0";
      merged.avgCost =
        inventoryProduct?.avgCost ?? fallbackProduct?.avgCost ?? 0;
      return merged;
    },
    [inventoryProductMap]
  );

  useEffect(() => {
    if (type !== "SALE" || !selectedSalesOrderId) {
      setSalesOrderDetails(null);
      setSalesOrderDetailsError("");
      setLoadingSalesOrderDetails(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    async function loadSalesOrderDetails() {
      setLoadingSalesOrderDetails(true);
      setSalesOrderDetailsError("");
      try {
        const res = await fetch(`/api/sales-orders/${selectedSalesOrderId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Impossible de charger les lignes de commande.");
        }
        const data = await res.json();
        if (!cancelled) {
          setSalesOrderDetails(data);
        }
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setSalesOrderDetails(null);
        setSalesOrderDetailsError(
          err?.message || "Erreur lors du chargement des lignes de commande."
        );
      } finally {
        if (!cancelled) {
          setLoadingSalesOrderDetails(false);
        }
      }
    }
    loadSalesOrderDetails();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [type, selectedSalesOrderId]);

  const addLine = () => {
    setLines((prev) => [...prev, buildLine()]);
  };

  const removeLine = (key) => {
    setLines((prev) =>
      prev.length > 1 ? prev.filter((line) => line.key !== key) : prev
    );
  };

  const updateLine = (key, field, value) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, [field]: value } : line
      )
    );
  };

  const handleProductSelect = (key, product) => {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key
          ? {
              ...line,
              productId: product?.id || "",
              product: product || null,
            }
          : line
      )
    );
  };

  const handleSalesOrderChange = (event) => {
    const value = event.target.value;
    if (value === "__create__") {
      if (typeof window !== "undefined") {
        window.open("/sales-orders/create", "_blank", "noopener");
      } else {
        router.push("/sales-orders/create");
      }
      return;
    }
    if (value !== salesOrderRef) {
      setLines((prev) =>
        prev.map((line) => ({
          ...line,
          salesOrderLineId: "",
          productId: "",
          product: null,
          quantity: "",
        }))
      );
    }
    setSalesOrderRef(value);
    setSalesOrderDetails(null);
    setSalesOrderDetailsError("");
  };

  const handleSalesOrderLineSelect = (key, salesOrderLineId) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        if (!salesOrderLineId) {
          return {
            ...line,
            salesOrderLineId: "",
            productId: "",
            product: null,
          };
        }
        const related = salesOrderLineMap.get(salesOrderLineId);
        const productId =
          related?.product?.id || related?.productId || line.productId || "";
        const resolvedProduct = resolveProductById(
          productId,
          related?.product || line.product
        );
        let nextQuantity = line.quantity;
        if (!nextQuantity || Number(nextQuantity) <= 0) {
          const remaining = related?.remaining ?? null;
          if (typeof remaining === "number" && Number.isFinite(remaining)) {
            nextQuantity = remaining > 0 ? remaining.toFixed(3) : "";
          }
        }
        return {
          ...line,
          salesOrderLineId,
          productId,
          product: resolvedProduct,
          quantity: nextQuantity,
        };
      })
    );
  };

  const handleCreateSalesOrder = () => {
    if (typeof window !== "undefined") {
      window.open("/sales-orders/create", "_blank", "noopener");
    } else {
      router.push("/sales-orders/create");
    }
  };

  const validate = () => {
    if (!type) {
      setError("Sélectionnez un type de sortie.");
      return false;
    }
    if (type === "SALE" && !salesOrderRef.trim()) {
      setError(
        "La commande client est obligatoire pour une sortie de type Vente."
      );
      return false;
    }
    const cleaned = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      let relatedOrderLine = null;
      if (type === "SALE") {
        if (!line.salesOrderLineId) {
          setError(
            `Ligne ${index + 1}: sélectionnez une ligne de commande client.`
          );
          return false;
        }
        relatedOrderLine = salesOrderLineMap.get(line.salesOrderLineId);
        if (!relatedOrderLine) {
          setError(
            `Ligne ${index + 1}: la ligne de commande sélectionnée est introuvable ou indisponible.`
          );
          return false;
        }
      }
      const resolvedProductId =
        type === "SALE"
          ? line.productId ||
            relatedOrderLine?.product?.id ||
            relatedOrderLine?.productId ||
            ""
          : line.productId;
      if (!resolvedProductId) {
        setError(`Ligne ${index + 1}: sélectionnez un produit.`);
        return false;
      }
      const product =
        productMap.get(resolvedProductId) ||
        resolveProductById(resolvedProductId, relatedOrderLine?.product || line.product);
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Ligne ${index + 1}: quantité invalide.`);
        return false;
      }
      if (type === "SALE") {
        const remaining = relatedOrderLine?.remaining ?? 0;
        if (qty > remaining + 1e-6) {
          setError(
            `Ligne ${index + 1}: quantité (${qty.toFixed(
              3
            )}) supérieure au solde préparable de la commande (${remaining.toFixed(
              3
            )}).`
          );
          return false;
        }
      }
      const available = Number(product?.qtyOnHand ?? 0);
      if (
        Number.isFinite(available) &&
        available >= 0 &&
        qty > available + 1e-6
      ) {
        setError(
          `Ligne ${index + 1}: quantité demandée (${qty}) supérieure au stock disponible (${available}).`
        );
        return false;
      }
      cleaned.push({
        productId: resolvedProductId,
        quantity: qty,
        notes: line.notes?.trim() ? line.notes.trim() : undefined,
        salesOrderLineId:
          type === "SALE" ? line.salesOrderLineId || undefined : undefined,
      });
    }
    return cleaned;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    const cleanedLines = validate();
    if (!cleanedLines) return;

    const payload = {
      type,
      manufacturingOrderRef: manufacturingOrderRef.trim() || undefined,
      salesOrderRef: salesOrderRef.trim() || undefined,
      notes: notes.trim() || undefined,
      requestedById: requestedById.trim() || undefined,
      lines: cleanedLines,
    };

    setSubmitting(true);
    try {
      let res;
      if (mode === "edit" && initialData?.id) {
        res = await fetch(`/api/stock-withdrawals/${initialData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "UPDATE", ...payload }),
        });
      } else {
        res = await fetch("/api/stock-withdrawals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Erreur lors de l'enregistrement.");
        return;
      }
      setSuccessMessage(
        mode === "edit"
          ? "Sortie de stock mise � jour."
          : `Sortie ${data.number || ""} créée.`
      );
      if (mode === "create") {
        if (onSuccess) onSuccess(data);
        else router.push(`/stock-withdrawals/${data.id}`);
      } else if (mode === "edit") {
        if (onSuccess) onSuccess(data);
      }
    } catch (err) {
      setError(err.message || "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section className="bg-white border border-slate-200 rounded px-4 py-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col text-sm">
            <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
              Type de sortie
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="border rounded px-2 py-1 text-sm"
              disabled={submitting}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
              Demandeur (ID utilisateur, optionnel)
            </span>
            <input
              type="text"
              value={requestedById}
              onChange={(event) => setRequestedById(event.target.value)}
              className="border rounded px-2 py-1 text-sm"
              placeholder="UUID de l'utilisateur (laisser vide si inconnu)"
              disabled={submitting}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
              Ordre fabrication
            </span>
            <input
              type="text"
              value={manufacturingOrderRef}
              onChange={(event) => setManufacturingOrderRef(event.target.value)}
              className="border rounded px-2 py-1 text-sm"
              placeholder="Optionnel"
              disabled={submitting}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
              Commande client
            </span>
            {type === "SALE" ? (
              <div className="space-y-1">
                <div className="flex gap-2">
                  <select
                    value={salesOrderRef}
                    onChange={handleSalesOrderChange}
                    className="border rounded px-2 py-1 text-sm"
                    disabled={submitting}
                    required
                  >
                    <option value="">Sélectionner une commande</option>
                    {salesOrderOptions.map((option) => (
                      <option
                        key={option.value || option.label}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                    <option value="__create__">
                      Créer une commande client…
                    </option>
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateSalesOrder}
                    className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-100"
                    disabled={submitting}
                  >
                    Nouvelle
                  </button>
                </div>
                {loadingSalesOrders && (
                  <p className="text-[11px] text-slate-500">
                    Chargement des commandes clients...
                  </p>
                )}
                {salesOrdersError && (
                  <p className="text-[11px] text-rose-600">
                    {salesOrdersError}
                  </p>
                )}
                {selectedSalesOrderId && loadingSalesOrderDetails && (
                  <p className="text-[11px] text-slate-500">
                    Chargement des lignes de commande...
                  </p>
                )}
                {salesOrderDetailsError && !loadingSalesOrderDetails && (
                  <p className="text-[11px] text-rose-600">
                    {salesOrderDetailsError}
                  </p>
                )}
                {selectedSalesOrderId &&
                  !loadingSalesOrderDetails &&
                  !salesOrderDetailsError &&
                  salesOrderLineOptions.length === 0 && (
                    <p className="text-[11px] text-amber-600">
                      Aucune ligne disponible sur cette commande.
                    </p>
                  )}
                {!loadingSalesOrders && !salesOrdersError && !salesOrderOptions.length && (
                  <p className="text-[11px] text-amber-600">
                    Aucune commande client disponible.
                  </p>
                )}
                {salesOrderRef && (
                  <p className="text-[11px] text-slate-600">
                    Client :{" "}
                    <span className="font-medium">
                      {selectedClientName}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={salesOrderRef}
                onChange={(event) => setSalesOrderRef(event.target.value)}
                className="border rounded px-2 py-1 text-sm"
                placeholder="Optionnel"
                disabled={submitting}
              />
            )}
          </label>
        </div>
        <label className="flex flex-col text-sm">
          <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
            Notes
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="border rounded px-2 py-1 text-sm"
            placeholder="Commentaires optionnels"
            disabled={submitting}
          />
        </label>
      </section>

      <section className="bg-white border border-slate-200 rounded px-4 py-4 space-y-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Lignes produits
          </h3>
          <button
            type="button"
            onClick={addLine}
            className="text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded"
            disabled={submitting}
          >
            Ajouter une ligne
          </button>
        </header>
        <div className="space-y-3">
          {lines.map((line) => {
            const isSale = type === "SALE";
            const orderLine =
              isSale && line.salesOrderLineId
                ? salesOrderLineMap.get(line.salesOrderLineId)
                : null;
            const inferredProductId =
              line.productId ||
              orderLine?.product?.id ||
              orderLine?.productId ||
              "";
            const fallbackProduct =
              isSale && orderLine
                ? resolveProductById(inferredProductId, orderLine.product)
                : null;
            const selectedProduct =
              productMap.get(inferredProductId) ||
              line.product ||
              fallbackProduct;
            const stockValue = Number(selectedProduct?.qtyOnHand ?? 0);
            const avgCostValue = Number(selectedProduct?.avgCost ?? 0);
            const stockLabel = Number.isFinite(stockValue)
              ? stockValue.toFixed(3)
              : "0.000";
            const avgCostLabel = Number.isFinite(avgCostValue)
              ? avgCostValue.toFixed(2)
              : "0.00";
            const remainingOrderQty =
              orderLine?.remaining != null
                ? Number(orderLine.remaining)
                : null;
            const remainingOrderLabel =
              remainingOrderQty != null && Number.isFinite(remainingOrderQty)
                ? remainingOrderQty.toFixed(3)
                : null;

            return (
              <div
                key={line.key}
                className="border border-slate-200 rounded px-3 py-3 bg-slate-50 space-y-2"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_repeat(2,minmax(0,1fr))_auto]">
                  <div>
                    <span className="block text-[11px] uppercase text-slate-500 tracking-wide mb-1">
                      {isSale
                        ? "Ligne de commande client"
                        : "Produit"}
                    </span>
                    {isSale ? (
                      <div className="space-y-2">
                        <select
                          value={line.salesOrderLineId}
                          onChange={(event) =>
                            handleSalesOrderLineSelect(
                              line.key,
                              event.target.value
                            )
                          }
                          className="border rounded px-2 py-1 text-sm"
                          disabled={
                            submitting ||
                            loadingSalesOrderDetails ||
                            !selectedSalesOrderId
                          }
                        >
                          <option value="">
                            Sélectionner une ligne de commande
                          </option>
                          {salesOrderLineOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={
                                option.disabled &&
                                option.value !== line.salesOrderLineId
                              }
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {orderLine && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                            <p className="flex-1 min-w-[160px]">
                              Produit :{" "}
                              <span className="font-medium">
                                {orderLine.product?.name || "—"}
                              </span>
                            </p>
                            <p className="flex items-center gap-1 font-mono text-slate-700">
                              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                Reste
                              </span>
                              <span className="inline-flex min-w-[68px] justify-end">
                                {remainingOrderLabel ?? "0.000"}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <ProductAutocomplete
                        value={selectedProduct}
                        onChange={(product) => handleProductSelect(line.key, product)}
                        products={productOptions}
                      />
                    )}
                  </div>
                  <label className="flex flex-col text-sm">
                    <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
                      Quantité
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      max={
                        isSale && remainingOrderQty != null
                          ? Math.max(0, remainingOrderQty)
                          : undefined
                      }
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, "quantity", event.target.value)
                      }
                      className="border rounded px-2 py-1 text-sm"
                      placeholder={
                        isSale && remainingOrderLabel
                          ? remainingOrderLabel
                          : "0.000"
                      }
                      disabled={submitting || (isSale && !line.salesOrderLineId)}
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    <span className="text-[11px] uppercase text-slate-500 tracking-wide mb-1">
                      Notes
                    </span>
                    <input
                      type="text"
                      value={line.notes}
                      onChange={(event) =>
                        updateLine(line.key, "notes", event.target.value)
                      }
                      className="border rounded px-2 py-1 text-sm"
                      placeholder="Optionnel"
                      disabled={submitting}
                    />
                  </label>
                  <div className="flex flex-col justify-between text-[11px] text-slate-600">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="self-start text-rose-600 hover:text-rose-700 underline"
                      disabled={submitting || lines.length === 1}
                    >
                      Supprimer
                    </button>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>
                        Stock restant{" "}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white border border-slate-200">
                          {stockLabel}
                        </span>
                      </span>
                      <span>
                        CUMP{" "}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white border border-slate-200">
                          {avgCostLabel} €
                        </span>
                      </span>
                      {isSale && remainingOrderLabel && (
                        <span>
                          SO restant{" "}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white border border-slate-200">
                            {remainingOrderLabel}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {loadingProducts && (
          <p className="text-[11px] text-slate-500">
            Chargement des produits en stock...
          </p>
        )}
      </section>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {successMessage && (
        <p className="text-sm text-emerald-600">{successMessage}</p>
      )}

      <footer className="flex items-center gap-2">
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          disabled={submitting}
        >
          {mode === "edit" ? "Enregistrer les modifications" : "Créer la sortie"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm px-3 py-2 text-slate-600 hover:text-slate-800"
            disabled={submitting}
          >
            Annuler
          </button>
        )}
        {mode !== "edit" && (
          <span className="ml-auto text-[11px] text-slate-500">
            {lines.length} ligne{lines.length > 1 ? "s" : ""} {" "}
            {TYPE_LABELS[type]}
          </span>
        )}
      </footer>
    </form>
  );
}
