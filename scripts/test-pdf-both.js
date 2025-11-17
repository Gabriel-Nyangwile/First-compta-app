#!/usr/bin/env node
/**
 * Combined PDF smoke test: client + incoming invoice.
 * - Creates sample client invoice + incoming invoice if missing
 * - Optionally starts dev server (one instance) and waits for /api/health
 * - Fetches both PDFs and validates size
 * Args: --start-server --base-url URL --retries N --retry-delay ms
 */
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import prisma from '../src/lib/prisma.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { startServer: false, retries: 5, retryDelay: 1000, baseUrl: process.env.PDF_BASE_URL || 'http://localhost:3000' };
  for (let i=0;i<args.length;i++) {
    const a = args[i];
    if (a === '--start-server') opts.startServer = true;
    else if (a === '--retries') opts.retries = parseInt(args[++i]||'5',10);
    else if (a === '--retry-delay') opts.retryDelay = parseInt(args[++i]||'1000',10);
    else if (a === '--base-url') opts.baseUrl = args[++i];
  }
  return opts;
}

async function waitHealth(baseUrl, { timeoutMs=90000, intervalMs=1500 }={}) {
  const start = Date.now();
  const url = `${baseUrl}/api/health`;
  while (Date.now()-start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) { const j = await r.json().catch(()=>null); if (j && j.ok) return true; } } catch {}
    // Fallback to root liveness if /api/health is not available
    try { const root = await fetch(baseUrl); if (root.ok) return true; } catch {}
    await delay(intervalMs);
  }
  throw new Error('Health timeout');
}

async function ensureClientInvoice() {
  const inv = await prisma.invoice.findFirst({ select: { id: true } });
  if (inv) return inv.id;
  let account = await prisma.account.findFirst();
  if (!account) account = await prisma.account.create({ data: { number: '700PDF', label: 'Ventes PDF' } });
  let client = await prisma.client.findFirst();
  if (!client) client = await prisma.client.create({ data: { name: 'Client PDF Both' } });
  const created = await prisma.invoice.create({ data: { invoiceNumber: 'C-BOTH-' + Date.now(), dueDate: new Date(Date.now()+86400000*7), clientId: client.id, totalAmount: 0, totalAmountHt: 0, vat: 0, vatAmount: 0, invoiceLines: { create: [{ description: 'Ligne', unitOfMeasure: 'U', quantity: '1', unitPrice: '0', lineTotal: '0', accountId: account.id }] } } });
  return created.id;
}

async function ensureIncomingInvoice() {
  const inv = await prisma.incomingInvoice.findFirst({ select: { id: true } });
  if (inv) return inv.id;
  let account = await prisma.account.findFirst();
  if (!account) account = await prisma.account.create({ data: { number: '600PDF', label: 'Achats PDF' } });
  let supplier = await prisma.supplier.findFirst();
  if (!supplier) supplier = await prisma.supplier.create({ data: { name: 'Fournisseur PDF Both' } });
  const created = await prisma.incomingInvoice.create({ data: { entryNumber: 'EI-BOTH-' + Date.now(), supplierInvoiceNumber: 'SUP-BOTH-' + Date.now(), supplierId: supplier.id, totalAmount: 0, totalAmountHt: 0, vat: 0, vatAmount: 0, lines: { create: [{ description: 'Ligne', accountId: account.id, unitOfMeasure: 'U', quantity: '1', unitPrice: '0', lineTotal: '0' }] } } });
  return created.id;
}

async function fetchPdf(url, opts) {
  let attempt=0; let lastErr;
  while (attempt <= opts.retries) {
    try { const res = await fetch(url); if (!res.ok) throw new Error('HTTP '+res.status); return Buffer.from(await res.arrayBuffer()); }
    catch(e){ lastErr = e; if (attempt===opts.retries) break; const wait = opts.retryDelay * Math.pow(1.5, attempt); console.log(`Retry ${attempt+1}/${opts.retries} ${url} after ${e.message} wait ${Math.round(wait)}ms`); await delay(wait);} attempt++; }
  throw lastErr;
}

async function run() {
  const opts = parseArgs();
  console.log('Options', opts);
  let devProc = null;
  let healthy = false;
  try { const r = await fetch(`${opts.baseUrl}/api/health`); if (r.ok) { const j = await r.json().catch(()=>null); healthy = !!(j&&j.ok); } } catch {}
  if (!healthy) { try { const root = await fetch(opts.baseUrl); healthy = root.ok; } catch {} }
  if (!healthy && opts.startServer) {
    console.log('Starting dev server...');
    devProc = spawn(process.platform === 'win32' ? 'npm.cmd':'npm', ['run','dev'], { stdio: 'pipe', env: process.env });
    await waitHealth(opts.baseUrl);
  } else if (!healthy) {
    throw new Error('Server not running and --start-server missing');
  }
  const clientId = await ensureClientInvoice();
  const incomingId = await ensureIncomingInvoice();
  const clientUrl = `${opts.baseUrl}/api/invoice/${clientId}/pdf`;
  const incomingUrl = `${opts.baseUrl}/api/incoming-invoices/${incomingId}/pdf`;
  const clientPdf = await fetchPdf(clientUrl, opts);
  assert.ok(clientPdf.length > 800, 'Client PDF too small');
  const incomingPdf = await fetchPdf(incomingUrl, opts);
  assert.ok(incomingPdf.length > 800, 'Incoming PDF too small');
  console.log('OK both PDFs', { clientBytes: clientPdf.length, incomingBytes: incomingPdf.length });
  if (devProc) devProc.kill('SIGINT');
}

run().catch(e => { console.error('FAIL', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
