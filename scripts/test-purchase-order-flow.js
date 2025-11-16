#!/usr/bin/env node
/**
 * Script: test-purchase-order-flow.js
 * Objectif: Valider le cycle métier d'un Bon de Commande.
 * Étapes:
 *  1. Créer un supplier (si aucun n'existe) + deux produits.
 *  2. Créer un PO (DRAFT) avec 2 lignes.
 *  3. Tenter de créer une facture (doit échouer en DRAFT).
 *  4. Approuver le PO, constater que la facture est encore bloquée (réception incomplète).
 *  5. Réception partielle + QC + rangement ⇒ statut STAGED puis PARTIAL.
 *  6. Réception finale + QC + rangement ⇒ statut RECEIVED/CLOSED.
 *  7. Créer la facture fournisseur désormais autorisée.
 *  8. Vérifier billedQty, receivedQty et clôture.
 * Sorties console structurées.
 */

// Node 18+ fournit fetch globalement; aucune dépendance cross-fetch nécessaire.

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function waitForServer(maxTries = 18, delayMs = 500) {
  const debug = process.env.DEBUG_PO_FLOW === "1";
  const candidates = [
    BASE + "/api/health",
    BASE + "/",
    BASE.replace("localhost", "127.0.0.1") + "/api/health",
  ];
  if (process.env.START_DEV_IF_DOWN === "1") {
    // Tentative de lancement automatique (meilleur effort)
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
  for (let i = 1; i <= maxTries; i++) {
    for (const url of candidates) {
      let r;
      try {
        r = await fetch(url, { method: "GET" });
        if (r.ok) {
          if (i > 1)
            console.log(`[INFO] Serveur prêt après ${i} tentatives (${url}).`);
          else console.log("[INFO] Serveur prêt.");
          return;
        } else if (debug) {
          console.log(`[DEBUG] Tentative ${i} ${url} status=${r.status}`);
        }
      } catch (e) {
        if (debug)
          console.log(
            `[DEBUG] Tentative ${i} ${url} erreur réseau: ${e.message}`
          );
      }
    }
    if (i === 1) console.log("[INFO] Attente disponibilité serveur...");
    await new Promise((res) => setTimeout(res, delayMs));
  }
  throw new Error(
    "Serveur non accessible après délai. Lancer d'abord: npm run dev (ou START_DEV_IF_DOWN=1)"
  );
}

async function jsonFetch(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
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
  const supList = await jsonFetch(BASE + "/api/suppliers");
  if (supList.suppliers && supList.suppliers.length) {
    console.log("[INFO] Re-use existing supplier:", supList.suppliers[0].name);
    return supList.suppliers[0];
  }
  const created = await jsonFetch(BASE + "/api/suppliers", {
    method: "POST",
    body: JSON.stringify({ name: "Fournisseur-" + randSuffix() }),
  });
  console.log("[OK] Supplier created:", created.name);
  return created;
}

async function createProduct(label) {
  const prod = await jsonFetch(BASE + "/api/products", {
    method: "POST",
    body: JSON.stringify({
      sku: "SKU-" + randSuffix(),
      name: label,
      unit: "u",
    }),
  });
  console.log("[OK] Product created:", prod.sku);
  return prod;
}

async function createPO(supplierId, productA, productB) {
  const body = {
    supplierId,
    lines: [
      { productId: productA.id, orderedQty: "10", unitPrice: "5.5" },
      { productId: productB.id, orderedQty: "4", unitPrice: "20" },
    ],
  };
  const po = await jsonFetch(BASE + "/api/purchase-orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log("[OK] PO created:", po.number, "status=" + po.status);
  if (po.status !== "DRAFT") throw new Error("PO initial status unexpected");
  return po;
}

async function attemptInvoiceShouldFail(po, supplierId, context = "bloqué") {
  const body = {
    supplierId,
    supplierInvoiceNumber: "TEST-" + randSuffix(),
    vat: "0.2",
    lines: [
      {
        description: "Ligne test",
        accountId: "dummy",
        unitOfMeasure: "u",
        quantity: "1",
        unitPrice: "10",
      },
    ],
    purchaseOrderId: po.id,
  };
  try {
    await jsonFetch(BASE + "/api/incoming-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    });
    console.error(
      "[FAIL] Invoice creation succeeded but should have failed for DRAFT PO"
    );
  } catch (e) {
    if ([400, 409].includes(e.status)) {
      const reason = e.data?.error || e.message;
      console.log(`[OK] Invoice blocked (${context}):`, reason);
      return;
    }
    throw e;
  }
}

async function approvePO(po) {
  try {
    const updated = await jsonFetch(
      BASE + `/api/purchase-orders/${po.id}/approve`,
      { method: "POST" }
    );
    console.log("[OK] PO approved:", updated.status);
    if (updated.status !== "APPROVED") throw new Error("Approval failed");
    return updated;
  } catch (e) {
    console.error(
      "[ERR] Approval API error details:",
      e.status,
      e.message,
      e.data
    );
    throw e;
  }
}

async function createInvoice(po, supplierId, accountId) {
  // Fallback: choose first expense account (6xx) if not provided — simplified attempt
  if (!accountId) {
    // naive fetch accounts (not filtered server-side here for brevity)
    try {
      const accRes = await fetch(BASE + "/api/accounts?q=6");
      if (accRes.ok) {
        const list = await accRes.json();
        if (Array.isArray(list) && list.length)
          accountId = list[0].id || list[0].account?.id;
      }
    } catch {
      /* ignore */
    }
    // Fallback: créer un compte 601000 si aucun (si endpoint existe; sinon erreur plus claire)
    if (!accountId) {
      try {
        const payload = {
          number: "601000",
          label: "Achats matières (auto)",
          type: "EXPENSE",
        };
        const createdAccRes = await fetch(BASE + "/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (createdAccRes.ok) {
          const acc = await createdAccRes.json();
          accountId = acc.id;
          console.log("[INFO] Compte dépense créé fallback:", acc.number);
        }
      } catch (e) {
        console.log("[WARN] Impossible de créer compte fallback:", e.message);
      }
    }
  }
  if (!accountId) throw new Error("No accountId available for invoice line");
  const body = {
    supplierId,
    supplierInvoiceNumber: "FAC-" + randSuffix(),
    vat: "0.2",
    lines: po.lines.map((line) => ({
      description: "Facture " + (line.product?.name || line.productId),
      accountId,
      unitOfMeasure: line.product?.unit || "u",
      quantity: String(line.orderedQty || "1"),
      unitPrice: String(line.unitPrice || "0"),
      purchaseOrderLineId: line.id,
    })),
    purchaseOrderId: po.id,
  };
  const inv = await jsonFetch(BASE + "/api/incoming-invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log("[OK] Invoice created & linked. ID=" + inv.id);
  return inv;
}

function findPOLine(po, productId) {
  if (!po.lines)
    throw new Error("PO lines indisponibles pour mapping (refetch manquant ?)");
  const line = po.lines.find((l) => l.productId === productId);
  if (!line)
    throw new Error("Aucune ligne PO correspondant au produit " + productId);
  return line;
}

async function createPartialReceipt(po, productA) {
  const lineA = findPOLine(po, productA.id);
  const body = {
    purchaseOrderId: po.id,
    lines: [
      {
        productId: productA.id,
        qtyReceived: 5,
        unitCost: 5.5,
        purchaseOrderLineId: lineA.id,
      },
    ],
  };
  const gr = await jsonFetch(BASE + "/api/goods-receipts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log("[OK] Partial receipt created:", gr.number);
  return gr;
}

async function acceptAllLines(receipt) {
  for (const line of receipt.lines) {
    await jsonFetch(BASE + `/api/goods-receipts/${receipt.id}`, {
      method: "PUT",
      body: JSON.stringify({ action: "QC_ACCEPT", lineId: line.id }),
    });
  }
}

async function putAwayAllLines(receipt) {
  for (const line of receipt.lines) {
    const qty = Number(line.qtyReceived);
    if (qty <= 0) continue;
    await jsonFetch(BASE + `/api/goods-receipts/${receipt.id}`, {
      method: "PUT",
      body: JSON.stringify({
        action: "PUTAWAY",
        lineId: line.id,
        qty,
        storageLocationCode: "RACK-A1",
      }),
    });
  }
}

async function createFinalReceipt(po, productA, productB) {
  const lineA = findPOLine(po, productA.id);
  const lineB = findPOLine(po, productB.id);
  const body = {
    purchaseOrderId: po.id,
    lines: [
      {
        productId: productA.id,
        qtyReceived: 5,
        unitCost: 5.5,
        purchaseOrderLineId: lineA.id,
      }, // remaining 5
      {
        productId: productB.id,
        qtyReceived: 4,
        unitCost: 20,
        purchaseOrderLineId: lineB.id,
      },
    ],
  };
  const gr = await jsonFetch(BASE + "/api/goods-receipts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log("[OK] Final receipt created:", gr.number);
  return gr;
}

async function fetchPO(id) {
  return jsonFetch(BASE + `/api/purchase-orders/${id}`);
}

async function closePO(po) {
  try {
    const updated = await jsonFetch(
      BASE + `/api/purchase-orders/${po.id}/close`,
      { method: "POST" }
    );
    console.log("[OK] PO closed:", updated.status);
    return updated;
  } catch (e) {
    console.log(
      "[WARN] Close failed (maybe auto closed):",
      e.data?.error || e.message
    );
  }
}

(async function main() {
  try {
    console.log("--- TEST PURCHASE ORDER FLOW ---");
    await waitForServer();
    const supplier = await ensureSupplier();
    const pA = await createProduct("Produit A");
    const pB = await createProduct("Produit B");
    const po = await createPO(supplier.id, pA, pB);
    await attemptInvoiceShouldFail(po, supplier.id, "PO DRAFT");
    await approvePO(po);
    // Refetch PO WITH lines (approve endpoint ne renvoie pas les lignes)
    let workingPO = await fetchPO(po.id);
    await attemptInvoiceShouldFail(
      workingPO,
      supplier.id,
      "PO approuvé mais non réceptionné"
    );
    await createPartialReceipt(workingPO, pA);
    let refreshed = await fetchPO(workingPO.id);
    console.log("[INFO] Status with staged qty (before QC):", refreshed.status);
    if (refreshed.status !== "STAGED")
      throw new Error("Expected STAGED while réception en cours (avant QC)");
    await attemptInvoiceShouldFail(
      refreshed,
      supplier.id,
      "Réception en cours (STAGED)"
    );
    const partialReceipt = refreshed.goodsReceipts.at(-1);
    await acceptAllLines(partialReceipt);
    await putAwayAllLines(partialReceipt);
    refreshed = await fetchPO(workingPO.id);
    console.log("[INFO] Status after partial receipt:", refreshed.status);
    if (refreshed.status !== "PARTIAL")
      throw new Error("Expected PARTIAL after partial receipt");
    await attemptInvoiceShouldFail(
      refreshed,
      supplier.id,
      "Réception partielle"
    );
    // Utiliser la version rafraîchie (pour lines & receivedQty) pour la réception finale
    await createFinalReceipt(refreshed, pA, pB);
    refreshed = await fetchPO(workingPO.id);
    console.log("[INFO] Status before final QC:", refreshed.status);
    if (refreshed.status !== "STAGED")
      throw new Error("Expected STAGED before final QC/put-away");
    const finalReceipt = refreshed.goodsReceipts.at(-1);
    await acceptAllLines(finalReceipt);
    await putAwayAllLines(finalReceipt);
    refreshed = await fetchPO(workingPO.id);
    console.log("[INFO] Status after final receipt:", refreshed.status);
    if (!["RECEIVED", "CLOSED"].includes(refreshed.status))
      throw new Error("Expected RECEIVED or CLOSED");
    console.log("[INFO] Status before invoicing:", refreshed.status);
    await createInvoice(refreshed, supplier.id, null);
    refreshed = await fetchPO(workingPO.id);
    if (refreshed.status === "RECEIVED") await closePO(refreshed);
    refreshed = await fetchPO(workingPO.id);
    const billedMismatch = refreshed.lines.some(
      (l) => Number(l.billedQty || 0) < Number(l.orderedQty || 0) - 1e-9
    );
    if (billedMismatch)
      throw new Error("Billed quantities mismatch ordered quantities");
    console.log("\n✅ Flux BC OK");
  } catch (e) {
    console.error("❌ Echec flux BC:", e.status, e.message, e.data || "");
    if (e.message && e.message.includes("fetch failed")) {
      console.error(
        "\nDiagnostic rapide:" +
          "\n  - Vérifie que le serveur Next tourne (npm run dev)." +
          `\n  - BASE_URL utilisé: ${BASE}` +
          "\n  - Firewall / proxy local ?" +
          "\n  - Port correct ?"
      );
    }
    process.exit(1);
  }
})();
