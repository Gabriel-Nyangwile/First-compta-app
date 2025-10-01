#!/usr/bin/env node
// Basic HTTP integration test for inventory & margins.
import assert from 'assert';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function json(res) { const t = await res.text(); try { return JSON.parse(t); } catch { throw new Error('Invalid JSON: '+t); } }

async function main() {
  console.log('HTTP test start (BASE=%s)', BASE);
  // Create product
  let r = await fetch(BASE + '/api/products', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ sku:'HTTPTEST-'+Date.now(), name:'Produit HTTP' }) });
  let prod = await json(r); assert(r.ok, prod.error); console.log('Product created', prod.id);
  // Stock adjust +10 at cost 3.5
  r = await fetch(BASE + '/api/stock-adjustments', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ productId: prod.id, qty:10, unitCost:3.5 }) });
  let adj = await json(r); assert(r.ok, adj.error); console.log('Adjustment IN ok');
  // Create invoice with OUT 4 units (simulate: need an account id; we skip invoice if missing account)
  // Minimal fallback: search any account for line
  const accRes = await fetch(BASE + '/api/account/search?query=7');
  const accounts = await accRes.json();
  const firstAcc = accounts?.[0];
  if (!firstAcc) { console.warn('No account found for test, skipping invoice part'); }
  else {
    const invBody = { invoiceLines:[{ description:'Test', accountId:firstAcc.id, quantity:4, unitPrice:10, productId: prod.id }], status:'PENDING' };
    r = await fetch(BASE + '/api/invoices', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(invBody) });
    const invData = await json(r);
    if (!r.ok) console.warn('Invoice creation failed:', invData); else console.log('Invoice created', invData.invoiceNumber);
  }
  // Margins endpoint
  r = await fetch(BASE + '/api/margins');
  const margins = await json(r); assert(r.ok, margins.error); console.log('Margins payload revenue=', margins.revenueHt, 'cogs=', margins.cogs);
  console.log('HTTP test completed.');
}

main().catch(e => { console.error(e); process.exit(1); });
