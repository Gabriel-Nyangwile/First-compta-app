#!/usr/bin/env node
/**
 * E2E: Vérifie le cycle complet retour fournisseur (PO → réception → facture → retour → badge)
 */

const DEFAULT_DELAY_MS = 500;
let baseUrl = process.env.BASE_URL || null;

function normalizeBase(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$|\s+/g, "");
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return `http://${trimmed}`;
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
  if (process.env.BASE_URL) push(candidates, process.env.BASE_URL);

  const ports = [
    process.env.PORT,
    process.env.NEXT_PORT,
    process.env.NEXTJS_PORT,
    process.env.NUXT_PORT,
    "3000",
    "3001",
  ]
    .filter(Boolean)
    .map((p) => String(p));

  for (const port of ports) {
    push(candidates, `http://localhost:${port}`);
    push(candidates, `http://127.0.0.1:${port}`);
  }

  if (!candidates.length) push(candidates, "http://localhost:3000");
  return candidates;
}

async function waitForServer(maxTries = 18, delayMs = DEFAULT_DELAY_MS) {
  const bases = collectBaseCandidates();
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    for (const base of bases) {
      const urls = [`${base}/api/health`, `${base}/api/status`, `${base}/`];
      for (const url of urls) {
        try {
          const res = await fetch(url, { method: "GET" });
          if (res.ok) {
            if (attempt > 1) {
              console.log(
                `[INFO] Serveur détecté après ${attempt} tentatives (${url}).]`
              );
            }
            return base;
          }
        } catch (err) {
          // continue
        }
      }
    }
    if (attempt === 1) {
      console.log("[INFO] Attente disponibilité serveur...");
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(
    "Serveur non accessible. Lancer d'abord `npm run dev` ou définir BASE_URL."
  );
}

async function jsonFetch(path, opts = {}) {
  if (!baseUrl) {
    baseUrl = await waitForServer();
  }
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  if (!res.ok) throw new Error((data && data.error) || data || res.statusText);
  return data;
}

function randSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function ensureSupplier() {
  const list = await jsonFetch("/api/suppliers");
  const suppliers = Array.isArray(list?.suppliers) ? list.suppliers : [];
  const existing = suppliers.find((s) => s.account?.id);
  if (existing) {
    console.log("[INFO] Réutilisation fournisseur:", existing.name);
    return { id: existing.id, accountId: existing.account.id };
  }
  throw new Error(
    "Aucun fournisseur avec compte comptable (401) n'est disponible. Importez le plan comptable et associez un compte."
  );
}

async function createProduct() {
  const product = await jsonFetch("/api/products", {
    method: "POST",
    body: JSON.stringify({
      sku: "E2E-" + randSuffix(),
      name: "Produit E2E",
      unit: "u",
    }),
  });
  console.log("[OK] Produit créé:", product.sku);
  return product;
}

async function findPurchaseAccount() {
  const candidates = [
    { type: "prefix", value: "601" },
    { type: "prefix", value: "607" },
    { type: "prefix", value: "60" },
    { type: "query", value: "60" },
    { type: "query", value: "6" },
  ];

  for (const c of candidates) {
    try {
      const url =
        c.type === "prefix"
          ? `/api/accounts?prefix=${c.value}`
          : `/api/accounts?q=${c.value}`;
      const accounts = await jsonFetch(url);
      if (Array.isArray(accounts) && accounts.length) {
        console.log("[INFO] Compte achat détecté:", accounts[0].number);
        return accounts[0];
      }
    } catch (err) {
      // ignore and try next
    }
  }
  throw new Error(
    "Impossible de trouver un compte d'achat (classe 60). Importez le plan comptable."
  );
}

async function main() {
  baseUrl = await waitForServer();
  console.log(`[INFO] Base URL utilisée: ${baseUrl}`);
  const supplier = await ensureSupplier();
  const product = await createProduct();

  const poCreated = await jsonFetch("/api/purchase-orders", {
    method: "POST",
    body: JSON.stringify({
      supplierId: supplier.id,
      lines: [{ productId: product.id, orderedQty: "5", unitPrice: "10" }],
    }),
  });
  console.log("[OK] PO créé:", poCreated.number);

  await jsonFetch(`/api/purchase-orders/${poCreated.id}/approve`, {
    method: "POST",
  });
  console.log("[OK] PO approuvé");

  const poDetail = await jsonFetch(`/api/purchase-orders/${poCreated.id}`);
  const poLine = poDetail.lines[0];
  if (!poLine) throw new Error("Ligne de PO introuvable");

  const gr = await jsonFetch("/api/goods-receipts", {
    method: "POST",
    body: JSON.stringify({
      purchaseOrderId: poDetail.id,
      lines: [
        {
          productId: product.id,
          qtyReceived: 5,
          unitCost: 10,
          purchaseOrderLineId: poLine.id,
        },
      ],
    }),
  });
  console.log("[OK] Réception créée:", gr.number);

  for (const line of gr.lines || []) {
    await jsonFetch(`/api/goods-receipts/${gr.id}`, {
      method: "PUT",
      body: JSON.stringify({ action: "QC_ACCEPT", lineId: line.id }),
    });
    await jsonFetch(`/api/goods-receipts/${gr.id}`, {
      method: "PUT",
      body: JSON.stringify({
        action: "PUTAWAY",
        lineId: line.id,
        qty: 5,
        unitCost: 10,
        storageLocationCode: "E2E-LOC",
      }),
    });
  }
  console.log("[OK] QC & rangement effectués");

  const account = await findPurchaseAccount();
  const grDetailPreReturn = await jsonFetch(`/api/goods-receipts/${gr.id}`);
  const grLine = grDetailPreReturn.lines[0];
  if (!grLine) throw new Error("Ligne réception introuvable");

  await jsonFetch("/api/incoming-invoices", {
    method: "POST",
    body: JSON.stringify({
      supplierId: supplier.id,
      purchaseOrderId: poDetail.id,
      supplierInvoiceNumber: "E2E-INV-" + randSuffix(),
      lines: [
        {
          description: "Achat E2E",
          accountId: account.id,
          unitOfMeasure: "u",
          quantity: 5,
          unitPrice: 10,
          goodsReceiptLineId: grLine.id,
          purchaseOrderLineId: poLine.id,
        },
      ],
    }),
  });
  console.log("[OK] Facture fournisseur créée");

  await jsonFetch("/api/return-orders", {
    method: "POST",
    body: JSON.stringify({
      supplierId: supplier.id,
      purchaseOrderId: poDetail.id,
      goodsReceiptId: gr.id,
      reason: "Test E2E",
      lines: [{ goodsReceiptLineId: grLine.id, quantity: 2, unitCost: 10 }],
    }),
  });
  console.log("[OK] Retour fournisseur créé");

  const grAfterReturn = await jsonFetch(`/api/goods-receipts/${gr.id}`);
  const returnedQty = Number(grAfterReturn.lines[0]?.returnedQty || 0);
  if (returnedQty < 2) throw new Error("Badge retour non mis à jour");

  console.log(
    "[SUCCESS] Flux retour fournisseur E2E validé, badge:",
    returnedQty
  );
}

main().catch((e) => {
  console.error("[FAIL]", e.message);
  process.exit(1);
});
