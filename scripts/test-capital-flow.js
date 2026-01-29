#!/usr/bin/env node
import assert from "assert";

/* POUR Usage: npm run test:capital-flow -- --cleanup */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CLEANUP = process.argv.includes("--cleanup");

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error("Invalid JSON: " + t);
  }
}

async function ensureOk(res, payload, label) {
  if (!res.ok) {
    throw new Error(`${label} failed: ${payload?.error || res.status}`);
  }
}

async function findAccount(prefix) {
  const res = await fetch(`${BASE}/api/accounts?prefix=${encodeURIComponent(prefix)}`);
  const data = await json(res);
  if (!res.ok) throw new Error("Accounts lookup failed: " + (data?.error || res.status));
  return Array.isArray(data) ? data[0] : null;
}

async function fetchTransactions(kind, dateStart, dateEnd) {
  const url = new URL(`${BASE}/api/transactions`);
  url.searchParams.set("kind", kind);
  url.searchParams.set("dateStart", dateStart);
  url.searchParams.set("dateEnd", dateEnd);
  url.searchParams.set("pageSize", "200");
  const res = await fetch(url.toString());
  const data = await json(res);
  if (!res.ok) throw new Error(`Transactions ${kind} failed: ${data?.error || res.status}`);
  return data;
}

async function main() {
  console.log("Capital flow test start (BASE=%s)", BASE);

  // Create shareholder
  let res = await fetch(`${BASE}/api/shareholders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Associe Test " + Date.now(),
      type: "INDIVIDUAL",
      email: "associe@example.com",
    }),
  });
  let data = await json(res);
  await ensureOk(res, data, "Shareholder");
  const shareholderId = data.id;
  console.log("Shareholder", shareholderId);

  // Create capital operation
  res = await fetch(`${BASE}/api/capital-operations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "CONSTITUTION",
      form: "SARL",
      nominalTarget: 100000,
      premiumTarget: 20000,
      decisionRef: "TEST-001",
    }),
  });
  data = await json(res);
  await ensureOk(res, data, "Capital operation");
  const opId = data.id;
  console.log("Capital operation", opId);

  // Create subscription
  res = await fetch(`${BASE}/api/capital-operations/${opId}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shareholderId,
      nominalAmount: 100000,
      premiumAmount: 20000,
    }),
  });
  data = await json(res);
  await ensureOk(res, data, "Subscription");
  const subId = data.id;
  console.log("Subscription", subId);

  // Create call
  const today = new Date().toISOString().slice(0, 10);
  res = await fetch(`${BASE}/api/capital-calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capitalOperationId: opId,
      subscriptionId: subId,
      amountCalled: 20000,
      dueDate: today,
      label: "Appel test",
    }),
  });
  data = await json(res);
  await ensureOk(res, data, "Capital call");
  const callId = data.id;
  console.log("Call", callId);

  // Payment
  const bankAcc = await findAccount("52");
  assert(bankAcc, "Account 52x required for payment");
  res = await fetch(`${BASE}/api/capital-calls/${callId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: 20000,
      paymentDate: today,
      method: "BANK",
      accountId: bankAcc.id,
    }),
  });
  data = await json(res);
  await ensureOk(res, data, "Payment");
  console.log("Payment", data.id);

  // Regularization
  res = await fetch(`${BASE}/api/capital-operations/${opId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "REGISTERED", regularize: true }),
  });
  data = await json(res);
  await ensureOk(res, data, "Regularization");
  console.log("Regularized");

  // Validate operation state
  res = await fetch(`${BASE}/api/capital-operations/${opId}`, { cache: "no-store" });
  data = await json(res);
  await ensureOk(res, data, "Operation reload");
  assert(data.status === "REGISTERED", "Operation should be REGISTERED");
  assert(data.calls?.length, "Call missing");
  assert(data.calls[0].payments?.length, "Payment missing");

  // Check transactions per kind (balance)
  const kinds = [
    "CAPITAL_SUBSCRIPTION",
    "CAPITAL_CALL",
    "CAPITAL_PAYMENT",
    "CAPITAL_REGULARIZATION",
  ];
  for (const kind of kinds) {
    const tx = await fetchTransactions(kind, today, today);
    const debit = Number(tx.sums?.debit || 0);
    const credit = Number(tx.sums?.credit || 0);
    const diff = Math.abs(debit - credit);
    assert(diff < 0.01, `Unbalanced ${kind}: debit=${debit} credit=${credit}`);
  }

  if (CLEANUP) {
    console.log("Cleanup...");
    await fetch(`${BASE}/api/capital-subscriptions/${subId}`, { method: "DELETE" }).catch(() => {});
    await fetch(`${BASE}/api/capital-calls/${callId}`, { method: "DELETE" }).catch(() => {});
    await fetch(`${BASE}/api/shareholders/${shareholderId}`, { method: "DELETE" }).catch(() => {});
    await fetch(`${BASE}/api/capital-operations/${opId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT", note: "cleanup" }),
    }).catch(() => {});
  }

  console.log("Capital flow OK");
}

main().catch((err) => {
  console.error("Capital flow test failed:", err);
  process.exit(1);
});
