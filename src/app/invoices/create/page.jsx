// app/invoices/create/page.js

"use client";
import { useState, useEffect } from "react";
import Amount from "@/components/Amount";
import AccountAutocomplete from "@/components/AccountAutocomplete";
import { useRouter } from "next/navigation";
import ClientNameAutocomplete from "@/components/ClientNameAutocomplete";
import Link from "next/link";

function toSafeNumber(value) {
  if (
    value &&
    typeof value === "object" &&
    typeof value.toNumber === "function"
  ) {
    try {
      return value.toNumber();
    } catch {
      // ignore and fallback to Number conversion below
    }
  }
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function buildLinesFromOrderLines(orderLines = []) {
  return orderLines
    .map((line) => {
      const ordered = toSafeNumber(line.quantityOrdered);
      const invoiced = toSafeNumber(line.quantityInvoiced);
      const remaining = ordered - invoiced;
      if (remaining <= 1e-9) return null;
      const quantity = Number(remaining.toFixed(3));
      const unitPrice = Number(toSafeNumber(line.unitPrice).toFixed(4));
      const lineTotal = Number((quantity * unitPrice).toFixed(2));
      const vatRate =
        line.vatRate === null || line.vatRate === undefined
          ? null
          : Number(line.vatRate);
      return {
        description:
          line.description || line.product?.name || "Ligne commande",
        accountId: line.accountId || "",
        accountNumber: line.account?.number || "",
        accountLabel: line.account?.label || "",
        unitOfMeasure: line.unit || line.product?.unit || "",
        quantity,
        unitPrice,
        lineTotal,
        productId: line.productId || null,
        salesOrderLineId: line.id,
        vatRate,
        fromSalesOrder: true,
        maxQuantity: quantity,
      };
    })
    .filter(Boolean);
}

function buildLinesFromWithdrawals(order, withdrawals = [], selectedIds = []) {
  const orderLines = Array.isArray(order?.lines) ? order.lines : [];
  const fallback = buildLinesFromOrderLines(orderLines);
  if (!withdrawals.length || !selectedIds.length) {
    return fallback;
  }
  const selectedSet = new Set(selectedIds);
  const aggregated = new Map();
  withdrawals.forEach((withdrawal) => {
    if (!selectedSet.has(withdrawal.id)) return;
    (withdrawal.lines || []).forEach((line) => {
      if (!line?.salesOrderLineId) return;
      const qty = toSafeNumber(line.quantity);
      if (qty <= 0) return;
      aggregated.set(
        line.salesOrderLineId,
        (aggregated.get(line.salesOrderLineId) || 0) + qty
      );
    });
  });
  if (!aggregated.size) {
    return fallback;
  }

  const computed = [];
  for (const line of orderLines) {
    const remaining = Math.max(
      0,
      toSafeNumber(line.quantityOrdered) - toSafeNumber(line.quantityInvoiced)
    );
    if (remaining <= 1e-9) continue;
    const withdrawalQuantity = aggregated.get(line.id) || 0;
    const quantity = Math.min(remaining, withdrawalQuantity);
    if (quantity <= 1e-9) continue;
    const resolvedQuantity = Number(quantity.toFixed(3));
    const unitPrice = Number(toSafeNumber(line.unitPrice).toFixed(4));
    const lineTotal = Number((resolvedQuantity * unitPrice).toFixed(2));
    const vatRate =
      line.vatRate === null || line.vatRate === undefined
        ? null
        : Number(line.vatRate);
    computed.push({
      description:
        line.description || line.product?.name || "Ligne commande",
      accountId: line.accountId || "",
      accountNumber: line.account?.number || "",
      accountLabel: line.account?.label || "",
      unitOfMeasure: line.unit || line.product?.unit || "",
      quantity: resolvedQuantity,
      unitPrice,
      lineTotal,
      productId: line.productId || null,
      salesOrderLineId: line.id,
      vatRate,
      fromSalesOrder: true,
      maxQuantity: Number(remaining.toFixed(3)),
    });
  }

  if (!computed.length) {
    return fallback;
  }

  return computed;
}

const createEmptyLine = () => ({
  description: "",
  accountId: "",
  accountNumber: "",
  accountLabel: "",
  unitOfMeasure: "",
  quantity: 1,
  unitPrice: 0,
  lineTotal: 0,
  productId: null,
  salesOrderLineId: null,
  vatRate: null,
  fromSalesOrder: false,
  maxQuantity: null,
});

export default function CreateInvoicePage() {
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [linkClient, setLinkClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    account: null,
  });
  const [creatingClient, setCreatingClient] = useState(false);
  const [vat, setVat] = useState(0.2);
  const [lines, setLines] = useState([createEmptyLine()]);
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [salesOrders, setSalesOrders] = useState([]);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);
  const [loadingSalesOrder, setLoadingSalesOrder] = useState(false);
  const [salesOrderError, setSalesOrderError] = useState("");
  const [stockWithdrawals, setStockWithdrawals] = useState([]);
  const [selectedWithdrawalIds, setSelectedWithdrawalIds] = useState([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState("");
  // Fonction utilitaire pour obtenir le délai en jours selon la catégorie
  function getDelayFromCategory(category) {
    switch (category) {
      case "CASH":
        return 0;
      case "DAYS_15":
        return 15;
      case "DAYS_30":
        return 30;
      case "DAYS_45":
        return 45;
      default:
        return 30;
    }
  }

  // Calcul automatique de la date d'échéance quand clientId ou issueDate change
  useEffect(() => {
    if (!clientId || !issueDate) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const delay = getDelayFromCategory(client.category);
    const date = new Date(issueDate);
    date.setDate(date.getDate() + delay);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    setDueDate(`${yyyy}-${mm}-${dd}`);
  }, [clientId, issueDate, clients]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Charger clients et comptes au chargement
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        // L'API renvoie { clients: [...] } désormais
        if (Array.isArray(data)) {
          setClients(data);
        } else if (Array.isArray(data.clients)) {
          setClients(data.clients);
        } else {
          setClients([]);
        }
      })
      .catch(() => setClients([]));
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) =>
        Array.isArray(data) ? setAccounts(data) : setAccounts([])
      )
      .catch(() => setAccounts([]));
    // Pré-remplir le numéro de facture automatiquement
    fetch("/api/invoices/next-number")
      .then((res) => res.json())
      .then((data) => setInvoiceNumber(data.invoiceNumber));
    // Pré-remplir la date d'émission avec la date du jour (format yyyy-mm-dd)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setIssueDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSalesOrders() {
      const queries = [
        "status=CONFIRMED&remaining=true",
        "status=CONFIRMED",
        "status=DRAFT",
        "status=FULFILLED",
        "",
      ];
      const byId = new Map();

      for (const query of queries) {
        try {
          const url = `/api/sales-orders${query ? `?${query}` : ""}`;
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const payload = await res.json().catch(() => []);
          const orders = Array.isArray(payload) ? payload : payload?.orders || [];
          for (const order of orders) {
            if (order?.id && !byId.has(order.id)) {
              byId.set(order.id, order);
            }
          }
        } catch {
          // ignore failing query
        }
      }

      if (cancelled) return;

      const statusPriority = {
        CONFIRMED: 0,
        DRAFT: 1,
        FULFILLED: 2,
        CANCELLED: 3,
      };

      const combined = Array.from(byId.values()).sort((a, b) => {
        const left =
          statusPriority[a.status] ?? statusPriority.CONFIRMED ?? Number.MAX_SAFE_INTEGER;
        const right =
          statusPriority[b.status] ?? statusPriority.CONFIRMED ?? Number.MAX_SAFE_INTEGER;
        if (left !== right) return left - right;
        return (a.number || "").localeCompare(b.number || "", "fr-FR");
      });

      setSalesOrders(combined);
    }

    loadSalesOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  // plus de filtrage, on affiche tous les clients dans le select

  useEffect(() => {
    let cancelled = false;

    async function loadOrder(orderId) {
      if (!orderId) {
        if (!cancelled) {
          setSelectedSalesOrder(null);
          setSalesOrderError("");
          setWithdrawalError("");
          setStockWithdrawals([]);
          setSelectedWithdrawalIds([]);
          setLoadingWithdrawals(false);
          setLines([createEmptyLine()]);
        }
        return;
      }

      setLoadingSalesOrder(true);
      setSalesOrderError("");
      setWithdrawalError("");
      setLoadingWithdrawals(true);
      try {
        const res = await fetch(`/api/sales-orders/${orderId}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(
            payload.error || "Impossible de charger la commande client."
          );
        }
        const order = await res.json();
        if (cancelled) return;

        setSelectedSalesOrder(order);
        if (order.client?.id) {
          setLinkClient(true);
          setClientId(order.client.id);
          setClients((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (!list.some((c) => c.id === order.client.id)) {
              return [...list, order.client];
            }
            return list;
          });
        }

        setAccounts((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          (order.lines || []).forEach((line) => {
            if (
              line.account &&
              !list.some((acc) => acc.id === line.account.id)
            ) {
              list.push(line.account);
            }
          });
          return list;
        });

        const baseLines = buildLinesFromOrderLines(order.lines || []);
        if (!baseLines.length) {
          setSalesOrderError(
            "Toutes les lignes de cette commande sont déjà facturées."
          );
          setStockWithdrawals([]);
          setSelectedWithdrawalIds([]);
          setLines([createEmptyLine()]);
          setSalesOrders((prev) =>
            Array.isArray(prev) ? prev.filter((o) => o.id !== orderId) : prev
          );
          return;
        }

        let withdrawalsData = [];
        try {
          const swRes = await fetch(
            `/api/stock-withdrawals?salesOrderId=${orderId}`
          );
          if (!swRes.ok) {
            const payload = await swRes.json().catch(() => ({}));
            throw new Error(
              payload.error ||
                "Impossible de récupérer les sorties de stock liées."
            );
          }
          const swPayload = await swRes.json();
          if (!cancelled) {
            withdrawalsData = Array.isArray(swPayload) ? swPayload : [];
          }
        } catch (swError) {
          if (!cancelled) {
            setWithdrawalError(
              swError?.message ||
                "Erreur lors du chargement des sorties de stock."
            );
          }
        }

        if (cancelled) return;

        setStockWithdrawals(withdrawalsData);
        const defaultWithdrawalIds = withdrawalsData.map((item) => item.id);
        setSelectedWithdrawalIds(defaultWithdrawalIds);

        const computedLines = buildLinesFromWithdrawals(
          order,
          withdrawalsData,
          defaultWithdrawalIds
        );
        if (computedLines.length) {
          setLines(computedLines);
        } else {
          setLines(baseLines);
          if (!withdrawalsData.length) {
            setWithdrawalError(
              "Aucune sortie de stock liée à cette commande. Les quantités proviennent du bon de commande."
            );
          } else {
            setWithdrawalError(
              "Les sorties sélectionnées ne proposent aucune quantité facturable restante."
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedSalesOrder(null);
          setSalesOrderError(
            error.message || "Erreur chargement commande client."
          );
          setStockWithdrawals([]);
          setSelectedWithdrawalIds([]);
          setLines([createEmptyLine()]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSalesOrder(false);
          setLoadingWithdrawals(false);
        }
      }
    }

    loadOrder(selectedSalesOrderId);
    return () => {
      cancelled = true;
    };
  }, [selectedSalesOrderId]);

  // Calculs dynamiques
  const totalAmountHt = lines.reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const vatAmount = lines.reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const resolvedRate =
      l.vatRate === null || l.vatRate === undefined
        ? Number(vat) || 0
        : Number(l.vatRate) || 0;
    return sum + qty * price * resolvedRate;
  }, 0);

  const totalAmount = totalAmountHt + vatAmount;

  // Gestion des lignes dynamiques
  const updateLine = (idx, patch) => {
    setLines((prev) => {
      if (idx < 0 || idx >= prev.length) return prev;
      const copy = [...prev];
      const base = copy[idx] || {};
      const merged = { ...base, ...patch };

      let quantity = Number(merged.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) quantity = 0;
      if (merged.fromSalesOrder && merged.maxQuantity != null) {
        quantity = Math.min(quantity, merged.maxQuantity);
      }
      merged.quantity = Number(quantity.toFixed(3));

      let unitPrice = Number(merged.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) unitPrice = 0;
      merged.unitPrice = Number(unitPrice.toFixed(4));

      merged.lineTotal = Number(
        (merged.quantity * merged.unitPrice).toFixed(2)
      );

      copy[idx] = merged;
      return copy;
    });
  };

  const handleLineChange = (idx, field, value) => {
    const currentLine = lines[idx];
    if (!currentLine) return;

    if (
      currentLine.fromSalesOrder &&
      ["account", "unitOfMeasure", "unitPrice", "productId"].includes(field)
    ) {
      return;
    }

    if (field === "account") {
      if (currentLine.fromSalesOrder) return;
      updateLine(idx, {
        accountId: value?.id || "",
        accountNumber: value?.number || "",
        accountLabel: value?.label || "",
      });
      if (value && value.id) {
        setAccounts((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          if (!list.some((acc) => acc.id === value.id)) {
            list.push(value);
          }
          return list;
        });
      }
      return;
    }

    if (field === "quantity" || field === "unitPrice") {
      const raw = Number(value);
      const safe = Number.isFinite(raw) ? Math.max(0, raw) : 0;
      if (field === "quantity" && currentLine.fromSalesOrder) {
        const capped =
          currentLine.maxQuantity != null
            ? Math.min(safe, currentLine.maxQuantity)
            : safe;
        updateLine(idx, { [field]: capped });
      } else {
        updateLine(idx, { [field]: safe });
      }
      return;
    }

    if (field === "vatRate") {
      const rate = value === "" || value === null ? null : Number(value);
      updateLine(idx, { vatRate: rate });
      return;
    }

    updateLine(idx, { [field]: value });
  };

  const handleCreateSalesOrder = () => {
    if (typeof window !== "undefined") {
      window.open("/sales-orders/create", "_blank", "noopener");
    } else {
      router.push("/sales-orders/create");
    }
  };

  const addLine = () => {
    if (selectedSalesOrderId) {
      setSalesOrderError(
        "Les lignes de facture doivent provenir du bon de commande sélectionné."
      );
      return;
    }
    setLines((prev) => [...prev, createEmptyLine()]);
  };

  const handleWithdrawalToggle = (withdrawalId) => {
    if (!selectedSalesOrder) return;
    setSelectedWithdrawalIds((prev) => {
      const set = new Set(prev);
      if (set.has(withdrawalId)) {
        set.delete(withdrawalId);
      } else {
        set.add(withdrawalId);
      }
      const next = Array.from(set);
      const computed = buildLinesFromWithdrawals(
        selectedSalesOrder,
        stockWithdrawals,
        next
      );
      if (computed.length) {
        setLines(computed);
        setWithdrawalError("");
      } else {
        const fallback = buildLinesFromOrderLines(
          selectedSalesOrder.lines || []
        );
        setLines(fallback.length ? fallback : [createEmptyLine()]);
        if (!stockWithdrawals.length) {
          setWithdrawalError(
            "Aucune sortie de stock liée à cette commande."
          );
        } else if (next.length === 0) {
          setWithdrawalError(
            "Aucune sortie de stock sélectionnée. Les quantités proviennent du bon de commande."
          );
        } else {
          setWithdrawalError(
            "Les sorties sélectionnées ne proposent aucune quantité facturable restante."
          );
        }
      }
      return next;
    });
  };
  const removeLine = (idx) =>
    setLines(lines.length > 1 ? lines.filter((_, i) => i !== idx) : lines);

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      setSalesOrderError("");

      if (!selectedSalesOrderId) {
        setSalesOrderError(
          "Veuillez sélectionner un bon de commande client avant de créer la facture."
        );
        return;
      }
      if (!lines.length) {
        setSalesOrderError(
          "Ajoutez au moins une ligne issue du bon de commande sélectionné."
        );
        return;
      }
      const missingLinkIndex = lines.findIndex(
        (line) => !line.salesOrderLineId
      );
      if (missingLinkIndex !== -1) {
        setSalesOrderError(
          `La ligne ${missingLinkIndex + 1} n'est pas associée au bon de commande.`
        );
        return;
      }
      const invalidQuantityIndex = lines.findIndex(
        (line) => (Number(line.quantity) || 0) <= 0
      );
      if (invalidQuantityIndex !== -1) {
        setSalesOrderError(
          `La quantité de la ligne ${invalidQuantityIndex + 1} doit être strictement positive.`
        );
        return;
      }

      const payloadLines = lines.map((line) => ({
        description: line.description,
        accountId: line.accountId || null,
        unitOfMeasure: line.unitOfMeasure || null,
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        vatRate:
          line.vatRate === null || line.vatRate === undefined
            ? null
            : Number(line.vatRate),
        lineTotal: Number(
          (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
        ),
        productId: line.productId || null,
        salesOrderLineId: line.salesOrderLineId || null,
      }));

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber,
          clientId: linkClient ? clientId || null : null,
          issueDate,
          dueDate,
          vat: Number(vat) || 0,
          salesOrderId: selectedSalesOrderId,
          invoiceLines: payloadLines,
        }),
      });
      if (res.ok) {
        router.push("/transactions");
      } else {
        alert("Erreur lors de la création de la facture");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors"
          >
            &larr; Retour
          </button>
          <Link
            href="/invoices"
            className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors"
          >
            Liste des factures
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Créer une nouvelle facture
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="invoiceNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Numéro de facture
            </label>
            <input
              type="text"
              id="invoiceNumber"
              name="invoiceNumber"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="INV-2025-001"
            />
          </div>
          {/* <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <div className="flex gap-2 items-center">
                    <select
                      id="clientId"
                      name="clientId"
                      required
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out bg-white"
                    >
                      <option value="">Sélectionner un client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.account?.number ? `- ${client.account.number}` : ""}
                        </option>
                      ))}
                    </select>
                  </div> 
              */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="salesOrderId"
            >
              Bon de commande client *
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="salesOrderId"
                required
                value={selectedSalesOrderId}
                onChange={(e) => setSelectedSalesOrderId(e.target.value)}
                className="mt-1 block w-full flex-1 min-w-[220px] px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out bg-white"
              >
                <option value="">Sélectionner un bon de commande</option>
                {salesOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number}{" "}
                    {order.client?.name ? `- ${order.client.name}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreateSalesOrder}
                className="text-sm text-blue-600 underline hover:text-blue-800 transition-colors"
              >
                Nouveau SO
              </button>
            </div>
            {loadingSalesOrder && (
              <div className="text-sm text-gray-500 mt-1">
                Chargement du bon de commande…
              </div>
            )}
            {salesOrderError && (
              <div className="text-sm text-red-600 mt-1">{salesOrderError}</div>
            )}
            {selectedSalesOrder && !salesOrderError && (
              <div className="text-xs text-gray-500 mt-1">
                Commande {selectedSalesOrder.number} •{" "}
                {selectedSalesOrder.lines?.length || 0} lignes originales
              </div>
            )}
          </div>

          {selectedSalesOrder && (
            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-gray-600">
                  Sorties de stock liées
                </p>
                {loadingWithdrawals && (
                  <span className="text-xs text-gray-500">
                    Chargement des sorties…
                  </span>
                )}
              </div>
              {!loadingWithdrawals && stockWithdrawals.length === 0 && (
                <p className="text-xs text-gray-500">
                  Aucune sortie de stock rattachée à cette commande.
                </p>
              )}
              {!loadingWithdrawals && stockWithdrawals.length > 0 && (
                <div className="space-y-2">
                  {stockWithdrawals.map((withdrawal) => {
                    const isChecked = selectedWithdrawalIds.includes(
                      withdrawal.id
                    );
                    const totalQty = (withdrawal.lines || []).reduce(
                      (sum, line) => sum + toSafeNumber(line.quantity),
                      0
                    );
                    return (
                      <label
                        key={withdrawal.id}
                        className={`flex items-start gap-3 rounded border px-3 py-2 bg-white text-xs text-gray-600 ${
                          isChecked
                            ? "border-blue-300 shadow-sm"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={isChecked}
                          onChange={() => handleWithdrawalToggle(withdrawal.id)}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-gray-700">
                              {withdrawal.number || "SW sans numéro"}
                            </span>
                            {withdrawal.status && (
                              <span className="text-gray-500">
                                Statut : {withdrawal.status}
                              </span>
                            )}
                            <span className="text-gray-500">
                              Qté totale : {totalQty.toFixed(3)}
                            </span>
                          </div>
                          <ul className="space-y-0.5 pl-4 list-disc">
                            {(withdrawal.lines || [])
                              .filter((line) => line.salesOrderLineId)
                              .map((line) => (
                                <li key={line.id}>
                                  {line.product?.name || "Produit"} —{" "}
                                  {toSafeNumber(line.quantity).toFixed(3)}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {withdrawalError && (
                <p className="text-xs text-amber-600">{withdrawalError}</p>
              )}
            </div>
          )}

          <>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={linkClient || Boolean(selectedSalesOrder?.client?.id)}
                disabled={Boolean(selectedSalesOrder?.client?.id)}
                onChange={(e) => {
                  if (selectedSalesOrder?.client?.id) return;
                  const checked = e.target.checked;
                  setLinkClient(checked);
                  if (!checked) {
                    setClientId("");
                  }
                }}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">
                Associer un client{" "}
              </span>
            </label>

            {linkClient && (
              <>
                <label
                  htmlFor="clientId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nom du client
                </label>
                <ClientNameAutocomplete
                  key={clientId || "no-client"}
                  value={
                    (Array.isArray(clients) ? clients : []).find(
                      (c) => c.id === clientId
                    ) || null
                  }
                  onChange={(clientObj) => setClientId(clientObj?.id || "")}
                  maxLength={20}
                />
                {/* Champ caché pour soumettre la valeur */}
                <input type="hidden" name="clientId" value={clientId} />
              </>
            )}
            {/* <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="Nom du client"
            />
          </div> */}

            {!clientId && (
              <button
                type="button"
                className="text-blue-600 underline text-sm"
                onClick={() => setShowNewClient(true)}
              >
                + Nouveau client
              </button>
            )}
          </>

          {/* Affichage du numéro de compte du client sélectionné */}
          {linkClient && clientId && (
            <div className="text-sm text-gray-500 mt-1">
              Compte client :{" "}
              {(() => {
                const list = Array.isArray(clients) ? clients : [];
                const client = list.find((c) => c.id === clientId);
                if (client && client.account && client.account.number)
                  return client.account.number;
                // Si le client vient d'être créé, il peut ne pas être dans la liste clients
                if (
                  newClient &&
                  newClient.account &&
                  newClient.account.number &&
                  clientId === newClient.id
                )
                  return newClient.account.number;
                return "-";
              })()}
            </div>
          )}

          {/* Modale création client */}
          {showNewClient && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
                <h2 className="text-lg font-bold mb-4">Nouveau client</h2>
                <input
                  type="text"
                  placeholder="Nom du client"
                  className="w-full mb-2 px-2 py-1 border rounded"
                  value={newClient.name}
                  onChange={(e) =>
                    setNewClient({ ...newClient, name: e.target.value })
                  }
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full mb-2 px-2 py-1 border rounded"
                  value={newClient.email}
                  onChange={(e) =>
                    setNewClient({ ...newClient, email: e.target.value })
                  }
                />
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compte comptable
                  </label>
                  <AccountAutocomplete
                    value={newClient.account}
                    onChange={(acc) =>
                      setNewClient({ ...newClient, account: acc })
                    }
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    disabled={
                      creatingClient ||
                      !newClient.name ||
                      (newClient.account && !newClient.account.id)
                    }
                    onClick={async () => {
                      if (!newClient.name) return;
                      setCreatingClient(true);
                      try {
                        const cliRes = await fetch("/api/clients", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: newClient.name,
                            email: newClient.email,
                            accountId: newClient.account?.id,
                          }),
                        });
                        const payload = await cliRes.json();
                        if (!cliRes.ok) {
                          alert(
                            payload.error ||
                              "Erreur lors de la création du client"
                          );
                          return;
                        }
                        setClients((prev) => [
                          ...prev,
                          { ...payload, account: newClient.account },
                        ]);
                        setClientId(payload.id);
                        setShowNewClient(false);
                        setNewClient({ name: "", email: "", account: null });
                      } catch (err) {
                        alert("Erreur réseau");
                      } finally {
                        setCreatingClient(false);
                      }
                    }}
                  >
                    {creatingClient ? "Création..." : "Créer"}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded border"
                    onClick={() => setShowNewClient(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lignes de facture
            </label>
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="flex flex-wrap gap-2 items-end border-b pb-2 mb-2"
              >
                {line.fromSalesOrder && (
                  <span className="text-xs text-blue-600 font-semibold w-full">
                    Ligne commande
                  </span>
                )}
                <input
                  type="text"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    handleLineChange(idx, "description", e.target.value)
                  }
                  className="w-32 px-2 py-1 border rounded"
                  required
                />
                <div className="w-32">
                  {line.fromSalesOrder ? (
                    <div className="px-2 py-1 border border-gray-300 rounded bg-gray-100 text-sm text-gray-700">
                      {line.accountNumber || "—"}
                    </div>
                  ) : (
                    <AccountAutocomplete
                      value={
                        line.accountId
                          ? {
                              id: line.accountId,
                              number:
                                line.accountNumber ||
                                (accounts.find((a) => a.id === line.accountId)
                                  ?.number ??
                                  ""),
                              label:
                                line.accountLabel ||
                                (accounts.find((a) => a.id === line.accountId)
                                  ?.label ??
                                  ""),
                            }
                          : null
                      }
                      onChange={(accObj) =>
                        handleLineChange(idx, "account", accObj)
                      }
                      maxLength={20}
                    />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Unité"
                  value={line.unitOfMeasure}
                  onChange={(e) =>
                    handleLineChange(idx, "unitOfMeasure", e.target.value)
                  }
                  className={`w-20 px-2 py-1 border rounded ${
                    line.fromSalesOrder ? "bg-gray-100 text-gray-600" : ""
                  }`}
                  disabled={line.fromSalesOrder}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Quantité"
                  value={line.quantity}
                  max={line.fromSalesOrder ? line.maxQuantity : undefined}
                  onChange={(e) =>
                    handleLineChange(idx, "quantity", e.target.value)
                  }
                  className="w-20 px-2 py-1 border rounded"
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Prix unitaire"
                  value={line.unitPrice}
                  onChange={(e) =>
                    handleLineChange(idx, "unitPrice", e.target.value)
                  }
                  className={`w-24 px-2 py-1 border rounded ${
                    line.fromSalesOrder ? "bg-gray-100 text-gray-600" : ""
                  }`}
                  disabled={line.fromSalesOrder}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="TVA"
                  value={line.vatRate ?? ""}
                  onChange={(e) =>
                    handleLineChange(idx, "vatRate", e.target.value)
                  }
                  className="w-20 px-2 py-1 border rounded"
                />
                <span className="w-24 text-right font-semibold">
                  <Amount value={line.lineTotal} />
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-red-500 px-2"
                >
                  ✕
                </button>
                {line.fromSalesOrder && line.maxQuantity != null && (
                  <div className="w-full text-xs text-gray-500">
                    Quantité restante maximale : {line.maxQuantity}
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className={`text-blue-600 font-semibold transition-opacity ${
                selectedSalesOrderId ? "opacity-40 cursor-not-allowed" : ""
              }`}
              disabled={Boolean(selectedSalesOrderId)}
            >
              + Ajouter une ligne
            </button>
            {selectedSalesOrderId && (
              <p className="text-xs text-gray-500">
                Les lignes sont importées depuis le bon de commande sélectionné.
              </p>
            )}
          </div>
          <div className="flex gap-4 items-center mt-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taux de TVA (%)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="flex-1 text-right">
              <div>
                Total HT :{" "}
                <span className="font-bold">
                  <Amount value={totalAmountHt} />
                </span>
              </div>
              <div>
                TVA :{" "}
                <span className="font-bold">
                  <Amount value={vatAmount} />
                </span>
              </div>
              <div>
                Total TTC :{" "}
                <span className="font-bold">
                  <Amount value={totalAmount} />
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'émission
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'échéance
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            {loading ? "Création..." : "Créer la facture"}
          </button>
        </form>
      </div>
    </main>
  );
}
