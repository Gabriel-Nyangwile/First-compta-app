#!/usr/bin/env node
/**
 * Validate supplier return order workflow:
 * - Create supplier, product, purchase order
 * - Receive goods, QC accept & put away
 * - Create a return order and assert stock + PO updates
 */

let baseUrl =
  process.env.BASE_URL ||
  (process.env.PORT
    ? `http://localhost:${process.env.PORT}`
    : "http://localhost:3000");

function normalizeBase(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

function collectBaseCandidates() {
  const push = (acc, candidate) => {
    const normalized = normalizeBase(candidate);
    if (normalized && !acc.includes(normalized)) {
      acc.push(normalized);
    }
  };

  const candidates = [];
  if (process.env.BASE_URL) {
    push(candidates, process.env.BASE_URL);
  }
  const extraPorts = [
    process.env.PORT,
    process.env.NEXT_PORT,
    process.env.NEXTJS_PORT,
    process.env.NUXT_PORT,
    "3000",
    "3001",
  ]
    .filter(Boolean)
    .map((p) => String(p));

  for (const port of extraPorts) {
    push(candidates, `http://localhost:${port}`);
    push(candidates, `http://127.0.0.1:${port}`);
  }

  if (!candidates.length) {
    push(candidates, "http://localhost:3000");
    push(candidates, "http://127.0.0.1:3000");
  }

  return candidates;
}

async function waitForServer(maxTries = 18, delayMs = 500) {
  const debug = process.env.DEBUG_RETURN_FLOW === "1";
  const baseCandidates = collectBaseCandidates();
  if (process.env.START_DEV_IF_DOWN === "1") {
    try {
      console.log(
        "[INFO] START_DEV_IF_DOWN=1 -> tentative démarrage dev server"
      );
      const { spawn } = await import("node:child_process");
      const child = spawn(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "dev"],
        {
          stdio: debug ? "inherit" : "ignore",
          shell: process.platform === "win32",
          env: { ...process.env },
          detached: process.platform !== "win32",
        }
      );
      child.unref();
    } catch (e) {
      console.log(
        "[WARN] Impossible de lancer automatiquement le dev server:",
        e.message
      );
    }
  }
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    for (const baseCandidate of baseCandidates) {
      const hostVariants = baseCandidate.includes("localhost")
        ? [baseCandidate, baseCandidate.replace("localhost", "127.0.0.1")]
        : [baseCandidate];

      for (const variant of hostVariants) {
        const probeTargets = [
          `${variant}/api/health`,
          `${variant}/api/status`,
          `${variant}/`,
        ];

        for (const url of probeTargets) {
          try {
            const res = await fetch(url, { method: "GET" });
            if (res.ok) {
              if (attempt > 1) {
                console.log(
                  `[INFO] Serveur prêt après ${attempt} tentatives (${url}).`
                );
              } else {
                console.log("[INFO] Serveur prêt.");
              }
              baseUrl = variant;
              return;
            }
            if (debug) {
              console.log(
                `[DEBUG] Tentative ${attempt} ${url} status=${res.status}`
              );
            }
          } catch (err) {
            if (debug) {
              console.log(
                `[DEBUG] Tentative ${attempt} ${url} erreur réseau: ${err.message}`
              );
            }
          }
        }
      }
    }

    if (attempt === 1) {
      console.log("[INFO] Attente disponibilité serveur...");
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    "Serveur non accessible. Lancer d'abord: npm run dev (ou START_DEV_IF_DOWN=1)"
  );
}

async function jsonFetch(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
        ...(process.env.ADMIN_TOKEN ? { 'x-admin-token': process.env.ADMIN_TOKEN } : {}),
      },
    });
  } catch (networkErr) {
    const err = new Error("fetch failed: " + networkErr.message);
    err.status = undefined;
    err.data = null;
    throw err;
  }
  let data = null;
  let raw = null;
  try {
    data = await res.json();
  } catch (parseErr) {
    raw = await res.text().catch(() => null);
  }
  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) ||
      raw ||
      `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data ?? raw;
    throw err;
  }
  return data ?? raw;
}

function randSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function ensureSupplier() {
  const list = await jsonFetch(baseUrl + "/api/suppliers");
  if (Array.isArray(list.suppliers) && list.suppliers.length) {
    console.log("[INFO] Re-use supplier:", list.suppliers[0].name);
    return list.suppliers[0];
  }
  const created = await jsonFetch(baseUrl + "/api/suppliers", {
    method: "POST",
    body: JSON.stringify({ name: "Supplier-" + randSuffix() }),
  });
  console.log("[OK] Supplier created:", created.name);
  return created;
}

async function createProduct(label) {
  // Ensure minimal ledger accounts
  const findAccount = async (prefix) => {
    try { const list = await jsonFetch(baseUrl + "/api/accounts?prefix=" + prefix); if (Array.isArray(list) && list.length) return list[0]; } catch {}
    try { const list = await jsonFetch(baseUrl + "/api/account/search?query=" + prefix); if (Array.isArray(list) && list.length) return list[0]; } catch {}
    return null;
  };
  let inventory = await findAccount("31");
  if (!inventory) {
    try { inventory = await jsonFetch(baseUrl + "/api/accounts", { method:'POST', body: JSON.stringify({ number:'310000', label:'Stock marchandises (auto)' }) }); } catch {}
  }
  if (!inventory) throw new Error("Aucun compte 31* disponible");
  let variation = await findAccount("603");
  if (!variation) {
    try { variation = await jsonFetch(baseUrl + "/api/accounts", { method:'POST', body: JSON.stringify({ number:'603000', label:'Variation de stock (auto)' }) }); } catch {}
  }
  if (!variation) throw new Error("Aucun compte 603* disponible");
  const product = await jsonFetch(baseUrl + "/api/products", {
    method: "POST",
    body: JSON.stringify({
      sku: "RET-" + randSuffix(),
      name: label,
      unit: "u",
      stockNature: "PURCHASED",
      inventoryAccountId: inventory.id,
      stockVariationAccountId: variation.id,
    }),
  });
  console.log("[OK] Product created:", product.sku);
  return product;
}

async function findPurchaseAccount() {
  const candidates = [
    { type: "prefix", value: "601" },
    { type: "prefix", value: "607" },
    { type: "prefix", value: "60" },
    { type: "prefix", value: "6" },
    { type: "query", value: "60" },
    { type: "query", value: "6" },
  ];

  for (const candidate of candidates) {
    try {
      const url =
        candidate.type === "prefix"
          ? `${baseUrl}/api/accounts?prefix=${candidate.value}`
          : `${baseUrl}/api/accounts?q=${candidate.value}`;
      const accounts = await jsonFetch(url);
      if (Array.isArray(accounts) && accounts.length) {
        return accounts[0];
      }
    } catch (e) {
      // Ignore and try next source
    }
  }
  throw new Error(
    "Aucun compte d'achat (classe 60) disponible pour lier la facture fournisseur."
  );
}

async function createIncomingInvoiceLine({
  supplierId,
  purchaseOrderId,
  purchaseOrderLineId,
  goodsReceiptLineId,
  quantity,
  unitPrice,
  accountId,
  description,
}) {
  const body = {
    supplierId,
    purchaseOrderId,
    supplierInvoiceNumber: `RET-INV-${randSuffix()}`,
    lines: [
      {
        description: description || "Retour test",
        accountId,
        unitOfMeasure: "u",
        quantity,
        unitPrice,
        goodsReceiptLineId,
        purchaseOrderLineId,
      },
    ],
  };
  await jsonFetch(baseUrl + "/api/incoming-invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createPO(supplierId, product, qty = 5, unitPrice = 12.5) {
  const body = {
    supplierId,
    lines: [
      {
        productId: product.id,
        orderedQty: String(qty),
        unitPrice: String(unitPrice),
      },
    ],
  };
  const po = await jsonFetch(baseUrl + "/api/purchase-orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log("[OK] Purchase order created:", po.number);
  if (!po.lines || !po.lines.length) {
    const refreshed = await jsonFetch(
      baseUrl + `/api/purchase-orders/${po.id}`
    );
    return refreshed;
  }
  return po;
}

async function approvePO(poId) {
  const updated = await jsonFetch(
    baseUrl + `/api/purchase-orders/${poId}/approve`,
    { method: "POST" }
  );
  if (updated.status !== "APPROVED") {
    throw new Error("PO non approuvé");
  }
  console.log("[OK] PO approuvé");
  return jsonFetch(baseUrl + `/api/purchase-orders/${poId}`);
}

async function createGoodsReceipt(po, product, qty = 5, unitCost = 12.5) {
  const line = po.lines.find((l) => l.productId === product.id);
  if (!line) throw new Error("Ligne de PO introuvable pour la réception");
  const receipt = await jsonFetch(baseUrl + "/api/goods-receipts", {
    method: "POST",
    body: JSON.stringify({
      purchaseOrderId: po.id,
      lines: [
        {
          productId: product.id,
          qtyReceived: qty,
          unitCost,
          purchaseOrderLineId: line.id,
        },
      ],
    }),
  });
  console.log("[OK] Réception créée:", receipt.number);
  return receipt;
}

async function qcAcceptAll(receiptId, lines) {
  for (const line of lines) {
    await jsonFetch(baseUrl + `/api/goods-receipts/${receiptId}`, {
      method: "PUT",
      body: JSON.stringify({ action: "QC_ACCEPT", lineId: line.id }),
    });
  }
  console.log("[OK] QC validé pour toutes les lignes");
}

async function putAwayAll(receiptId, lines) {
  for (const line of lines) {
    const qty = Number(line.qtyReceived);
    if (qty <= 0) continue;
    await jsonFetch(baseUrl + `/api/goods-receipts/${receiptId}`, {
      method: "PUT",
      body: JSON.stringify({
        action: "PUTAWAY",
        lineId: line.id,
        qty,
        storageLocationCode: "RET-LOC",
      }),
    });
  }
  console.log("[OK] Lignes rangées");
}

async function createReturnOrder({
  supplierId,
  purchaseOrderId,
  goodsReceiptId,
  goodsReceiptLineId,
  quantity,
  unitCost,
}) {
  const order = await jsonFetch(baseUrl + "/api/return-orders", {
    method: "POST",
    body: JSON.stringify({
      supplierId,
      purchaseOrderId,
      goodsReceiptId,
      reason: "Test retour automatique",
      notes: "Script test-return-order.js",
      lines: [
        {
          goodsReceiptLineId,
          quantity,
          unitCost,
          reason: "Produit défectueux",
        },
      ],
    }),
  });
  console.log("[OK] Retour fournisseur créé:", order.number);
  return order;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

(async function main() {
  try {
    console.log("--- TEST RETURN ORDER FLOW ---");
    await waitForServer();
    const supplier = await ensureSupplier();
    const product = await createProduct("Produit retour test");
    const initialPO = await createPO(supplier.id, product, 5, 12.5);
    const approvedPO = await approvePO(initialPO.id);
    const receipt = await createGoodsReceipt(approvedPO, product, 5, 12.5);

    await qcAcceptAll(receipt.id, receipt.lines);
    await putAwayAll(receipt.id, receipt.lines);

    const detailedReceipt = await jsonFetch(
      baseUrl + `/api/goods-receipts/${receipt.id}`
    );
    const targetLine = detailedReceipt.lines[0];
    assert(targetLine, "Ligne de réception introuvable après QC");
    assert(
      Number(targetLine.availableForReturn || 0) >= 5 - 1e-6,
      "Quantité disponible pour retour incorrecte après rangement"
    );

    const purchaseAccount = await findPurchaseAccount();
    const poLineId =
      targetLine.purchaseOrderLineId || targetLine.purchaseOrderLine?.id;
    assert(poLineId, "Identifiant ligne BC manquant pour la facture");
    await createIncomingInvoiceLine({
      supplierId: supplier.id,
      purchaseOrderId: approvedPO.id,
      purchaseOrderLineId: poLineId,
      goodsReceiptLineId: targetLine.id,
      quantity: Number(targetLine.qtyPutAway || targetLine.qtyReceived || 5),
      unitPrice: Number(
        targetLine.unitCostNumber ??
          targetLine.unitCost ??
          targetLine.unitCostValue ??
          12.5
      ),
      accountId: purchaseAccount.id,
      description: targetLine.product?.name || "Produit retour test",
    });

    const returnOrder = await createReturnOrder({
      supplierId: supplier.id,
      purchaseOrderId: approvedPO.id,
      goodsReceiptId: receipt.id,
      goodsReceiptLineId: targetLine.id,
      quantity: 2,
      unitCost: Number(
        targetLine.unitCostNumber ?? targetLine.unitCost ?? 12.5
      ),
    });

    const refreshedReceipt = await jsonFetch(
      baseUrl + `/api/goods-receipts/${receipt.id}`
    );
    const refreshedLine = refreshedReceipt.lines.find(
      (l) => l.id === targetLine.id
    );
    assert(refreshedLine, "Ligne de réception absente après retour");
    assert(
      Math.abs(Number(refreshedLine.returnedQty || 0) - 2) < 1e-6,
      "Quantité retournée non mise à jour"
    );
    assert(
      Math.abs(Number(refreshedLine.availableForReturn || 0) - 3) < 1e-6,
      "Disponible retour attendu 3"
    );

    const poAfterReturn = await jsonFetch(
      baseUrl + `/api/purchase-orders/${approvedPO.id}`
    );
    const poLine = poAfterReturn.lines.find((l) => l.productId === product.id);
    assert(poLine, "Ligne PO absente");
    assert(
      Math.abs(Number(poLine.returnedQty || 0) - 2) < 1e-6,
      "PO returnedQty incorrect"
    );
    assert(
      Number(poLine.receivedQty) - Number(poLine.returnedQty || 0) <
        Number(poLine.orderedQty) - 1e-6,
      "La quantité nette reçue devrait être inférieure au commandé après retour"
    );

    const orderDetail = await jsonFetch(
      baseUrl + `/api/return-orders/${returnOrder.id}`
    );
    assert(
      orderDetail.lines.length === 1,
      "Return order devrait avoir 1 ligne"
    );
    assert(
      Math.abs(Number(orderDetail.lines[0].quantity) - 2) < 1e-6,
      "Quantité retour détail incohérente"
    );

    let exceeded = false;
    try {
      await createReturnOrder({
        supplierId: supplier.id,
        purchaseOrderId: approvedPO.id,
        goodsReceiptId: receipt.id,
        goodsReceiptLineId: targetLine.id,
        quantity: 4,
        unitCost: Number(
          targetLine.unitCostNumber ?? targetLine.unitCost ?? 12.5
        ),
      });
    } catch (e) {
      exceeded = true;
      console.log("[OK] Sur-retour correctement bloqué:", e.message);
    }
    assert(exceeded, "La création d'un retour excédentaire aurait dû échouer");

    console.log("[SUCCESS] Flux retour fournisseur validé.");
    process.exit(0);
  } catch (err) {
    console.error("[FAIL]", err.message);
    if (err.status) {
      console.error("Status:", err.status, "Payload:", err.data);
    }
    process.exit(1);
  }
})();
