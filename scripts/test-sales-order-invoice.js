#!/usr/bin/env node
// Integration test: sales order -> invoice linkage
import assert from "assert";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON (${res.status}): ${text}`);
  }
}

async function findAccount(prefixes) {
  for (const prefix of prefixes) {
    let accounts = [];
    try {
      const res = await fetch(
        `${BASE}/api/account/search?query=${encodeURIComponent(prefix)}`,
        {
          headers: { Accept: "application/json" },
        }
      );
      if (res.ok) {
        accounts = await res.json();
      } else if (res.status === 404) {
        accounts = [];
      } else {
        const body = await res.text();
        throw new Error(`Recherche compte ${prefix} échouée: ${body}`);
      }
    } catch (error) {
      console.warn(`Recherche via /api/account/search échouée (${prefix})`, error);
      accounts = [];
    }

    if (!accounts.length) {
      const fallbackRes = await fetch(
        `${BASE}/api/accounts?prefix=${encodeURIComponent(prefix)}`,
        {
          headers: { Accept: "application/json" },
        }
      );
      if (fallbackRes.ok) {
        try {
          accounts = await fallbackRes.json();
        } catch (error) {
          console.warn("Lecture JSON fallback échouée", error);
          accounts = [];
        }
      }
    }

    const match = accounts.find((acc) => acc.number?.startsWith(prefix));
    if (match) {
      return match;
    }
  }
  return null;
}

async function main() {
  console.log("Sales order invoice test start (BASE=%s)", BASE);

  const clientAccount = await findAccount(["411"]);
  assert(clientAccount, "Compte client 411 requis.");

  const saleAccount = await findAccount(["707", "706", "701", "70"]);
  assert(saleAccount, "Compte de vente (70x) requis.");
  console.log("Sale account", saleAccount.number, saleAccount.id);

  const inventoryAccount = await findAccount(["31"]);
  assert(inventoryAccount, "Compte de stock (31x) requis.");

  const variationAccount = await findAccount(["603", "701"]);
  assert(variationAccount, "Compte de variation (603/701) requis.");

  const timestamp = Date.now();

  const clientRes = await fetch(`${BASE}/api/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Client SO ${timestamp}`,
      email: `client-${timestamp}@example.test`,
      accountId: clientAccount.id,
      category: "DAYS_30",
    }),
  });
  const clientPayload = await json(clientRes);
  assert(clientRes.ok, clientPayload.error || "Création client échouée");
  const clientId = clientPayload.id;
  console.log("Client created", clientId);

  const productRes = await fetch(`${BASE}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sku: `SO-PROD-${timestamp}`,
      name: "Produit SO",
      unit: "PCS",
      inventoryAccountId: inventoryAccount.id,
      stockVariationAccountId: variationAccount.id,
    }),
  });
  const productPayload = await json(productRes);
  assert(productRes.ok, productPayload.error || "Création produit échouée");
  const productId = productPayload.id;
  console.log("Product created", productId);

  const adjustRes = await fetch(`${BASE}/api/stock-adjustments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, qty: 10, unitCost: 25 }),
  });
  const adjustPayload = await json(adjustRes);
  assert(adjustRes.ok, adjustPayload.error || "Ajustement stock échoué");
  console.log("Inventory adjustment done");

  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);

  const soRes = await fetch(`${BASE}/api/sales-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      issueDate: issueDate.toISOString(),
      expectedShipDate: dueDate.toISOString(),
      currency: "EUR",
      lines: [
        {
          productId,
          accountId: saleAccount.id,
          quantityOrdered: 4,
          unitPrice: 50,
          vatRate: 0.2,
          unit: "PCS",
          description: "Ligne commande test",
        },
      ],
    }),
  });
  const soPayload = await json(soRes);
  if (!soRes.ok) {
    console.error("Sales order creation failed", {
      status: soRes.status,
      body: soPayload,
    });
    const dumpRes = await fetch(`${BASE}/api/clients/${clientId}`);
    const dumpClient = dumpRes.ok ? await dumpRes.json() : null;
    console.error("Client detail", dumpClient);
    const linesView = await fetch(
      `${BASE}/api/sales-orders?clientId=${clientId}`
    );
    const linesBody = linesView.ok ? await linesView.json() : null;
    console.error("Existing orders", linesBody);
  }
  assert(soRes.ok, soPayload.error || "Création commande échouée");
  const salesOrderId = soPayload.id;
  const salesOrderLineId = soPayload.lines?.[0]?.id;
  assert(salesOrderLineId, "ID ligne de commande manquant");
  console.log("Sales order created", salesOrderId);

  const confirmRes = await fetch(`${BASE}/api/sales-orders/${salesOrderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CONFIRM" }),
  });
  const confirmPayload = await json(confirmRes);
  assert(
    confirmRes.ok,
    confirmPayload.error || "Confirmation de la commande échouée"
  );
  console.log("Sales order confirmed");

  const invoiceRes = await fetch(`${BASE}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      salesOrderId,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      vat: 0.2,
      status: "PENDING",
      invoiceLines: [
        {
          description: "Facturation commande",
          accountId: saleAccount.id,
          unitOfMeasure: "PCS",
          quantity: 2,
          unitPrice: 50,
          vatRate: 0.2,
          productId,
          salesOrderLineId,
        },
      ],
    }),
  });
  const invoicePayload = await json(invoiceRes);
  assert(invoiceRes.ok, invoicePayload.error || "Création facture échouée");
  const invoiceId = invoicePayload.id;
  console.log("Invoice created", invoicePayload.invoiceNumber || invoiceId);

  const linkedLine = invoicePayload.invoiceLines?.find(
    (line) => line.salesOrderLineId === salesOrderLineId
  );
  assert(linkedLine, "La ligne de facture n'est pas liée à la commande.");

  const soAfterRes = await fetch(`${BASE}/api/sales-orders/${salesOrderId}`);
  const soAfterPayload = await json(soAfterRes);
  assert(
    soAfterRes.ok,
    soAfterPayload.error || "Lecture commande après facture échouée"
  );
  const invoiced = soAfterPayload.lines?.[0]?.quantityInvoiced;
  assert(
    Math.abs(Number(invoiced) - 2) < 1e-6,
    `Quantité facturée incorrecte: ${invoiced}`
  );
  console.log("Sales order invoiced quantity updated", invoiced);

  console.log("Sales order invoice test completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
