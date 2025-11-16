#!/usr/bin/env node
// Basic HTTP integration test for inventory & margins.
import assert from "assert";
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error("Invalid JSON: " + t);
  }
}

async function findAccount(prefixes) {
  for (const prefix of prefixes) {
    const res = await fetch(
      BASE + "/api/account/search?query=" + encodeURIComponent(prefix)
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error("Recherche compte " + prefix + " échouée: " + body);
    }
    const accounts = await res.json();
    const match = accounts.find((acc) => acc.number?.startsWith(prefix));
    if (match) {
      return match;
    }
  }
  return null;
}

async function main() {
  console.log("HTTP test start (BASE=%s)", BASE);
  const inventoryAccount = await findAccount(["31"]);
  const variationAccount = await findAccount(["603", "701"]);
  assert(
    inventoryAccount && variationAccount,
    "Compte de stock (31x) et compte de variation (603/701) requis."
  );
  // Create product
  let r = await fetch(BASE + "/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sku: "HTTPTEST-" + Date.now(),
      name: "Produit HTTP",
      inventoryAccountId: inventoryAccount.id,
      stockVariationAccountId: variationAccount.id,
    }),
  });
  let prod = await json(r);
  assert(r.ok, prod.error);
  console.log("Product created", prod.id);
  // Stock adjust +10 at cost 3.5
  r = await fetch(BASE + "/api/stock-adjustments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: prod.id, qty: 10, unitCost: 3.5 }),
  });
  let adj = await json(r);
  assert(r.ok, adj.error);
  console.log("Adjustment IN ok");
  // Create invoice with OUT 4 units (simulate: need an account id; we skip invoice if missing account)
  // Minimal fallback: search any account for line
  const accRes = await fetch(BASE + "/api/account/search?query=7");
  const accounts = await accRes.json();
  const firstAcc = accounts?.[0];
  if (!firstAcc) {
    console.warn("No account found for test, skipping invoice part");
  } else {
    const now = new Date();
    const issueDate = now.toISOString();
    const dueDate = new Date(
      now.getTime() + 15 * 24 * 60 * 60 * 1000
    ).toISOString();
    const invBody = {
      invoiceLines: [
        {
          description: "Test",
          accountId: firstAcc.id,
          quantity: 4,
          unitPrice: 10,
          productId: prod.id,
        },
      ],
      status: "PENDING",
      issueDate,
      dueDate,
    };
    r = await fetch(BASE + "/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invBody),
    });
    const invData = await json(r);
    if (!r.ok) console.warn("Invoice creation failed:", invData);
    else console.log("Invoice created", invData.invoiceNumber);
  }
  // Margins endpoint
  r = await fetch(BASE + "/api/margins");
  const margins = await json(r);
  assert(r.ok, margins.error);
  console.log(
    "Margins payload revenue=",
    margins.revenueHt,
    "cogs=",
    margins.cogs
  );
  console.log("HTTP test completed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
