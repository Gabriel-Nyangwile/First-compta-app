#!/usr/bin/env node
/**
 * Client invoice PDF smoke test (auto server start + readiness via /api/health).
 *  - Ensures at least one client + account + invoice (creates minimal one if needed)
 *  - Fetches /api/invoice/:id/pdf
 *  - Validates 200 + application/pdf + minimal size
 * Args:
 *   --start-server   auto start dev server if not running
 *   --retries N
 *   --retry-delay ms
 *   --base-url URL   (default http://localhost:3000)
 */
import prisma from '../src/lib/prisma.js';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { startServer: false, retries: 5, retryDelay: 1000, baseUrl: process.env.PDF_BASE_URL || 'http://localhost:3000' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--start-server') opts.startServer = true;
    else if (a === '--retries') opts.retries = parseInt(args[++i] || '5', 10);
    else if (a === '--retry-delay') opts.retryDelay = parseInt(args[++i] || '1000', 10);
    else if (a === '--base-url') opts.baseUrl = args[++i];
  }
  return opts;
}

async function ensureSampleClientInvoice() {
  // Try existing invoice first
  const existing = await prisma.invoice.findFirst({ select: { id: true } });
  if (existing) return existing.id;
  // Need a client and an account
  let client = await prisma.client.findFirst({});
  let account = await prisma.account.findFirst({});
  if (!account) {
    account = await prisma.account.create({ data: { number: '700TEST', label: 'Ventes Test' } });
  }
  if (!client) {
    client = await prisma.client.create({ data: { name: 'Client Test PDF' } });
  }
  const today = new Date();
  const due = new Date(Date.now() + 7*24*3600*1000);
  const created = await prisma.invoice.create({
    data: {
      invoiceNumber: 'C-PDF-' + Date.now(),
      issueDate: today,
      dueDate: due,
      clientId: client.id,
      totalAmount: 0,
      totalAmountHt: 0,
      vat: 0,
      vatAmount: 0,
      outstandingAmount: 0,
      invoiceLines: {
        create: [{ description: 'Ligne test', unitOfMeasure: 'U', quantity: '1', unitPrice: '0', lineTotal: '0', accountId: account.id }]
      }
    }
  });
  return created.id;
}

async function waitForHealth(baseUrl, { timeoutMs = 90000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  const health = `${baseUrl}/api/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(health, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json().catch(()=>null);
        if (j && j.ok) return true;
      }
    } catch { /* ignore */ }
    await delay(intervalMs);
  }
  throw new Error(`Health not OK after ${(timeoutMs/1000)}s: ${health}`);
}

async function fetchWithRetry(url, { retries, retryDelay }) {
  let attempt = 0; let lastErr;
  while (attempt <= retries) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      const wait = retryDelay * Math.pow(1.5, attempt);
      console.log(`Retry ${attempt+1}/${retries} after error: ${e.message} (sleep ${Math.round(wait)}ms)`);
      await delay(wait);
    }
    attempt++;
  }
  throw lastErr || new Error('Unknown fetch error');
}

async function run() {
  const opts = parseArgs();
  console.log('Options:', opts);
  const id = await ensureSampleClientInvoice();
  const pdfUrl = `${opts.baseUrl}/api/invoice/${id}/pdf`;

  // server detection
  let serverUp = false;
  try {
    const h = await fetch(`${opts.baseUrl}/api/health`, { cache: 'no-store' });
    if (h.ok) { const j = await h.json().catch(()=>null); serverUp = !!(j && j.ok); }
  } catch { serverUp = false; }

  let devProc = null;
  if (!serverUp && opts.startServer) {
    console.log('Starting dev server...');
    devProc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','dev'], { stdio: 'pipe', env: process.env });
    devProc.stdout.on('data', d => {
      const line = d.toString();
      if (line.toLowerCase().includes('ready')) {
        // heuristic only
      }
    });
    await waitForHealth(opts.baseUrl);
  } else if (!serverUp && !opts.startServer) {
    throw new Error('Server not running and --start-server not provided');
  }

  const res = await fetchWithRetry(pdfUrl, { retries: opts.retries, retryDelay: opts.retryDelay });
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('application/pdf'), 'Expected application/pdf got ' + ct);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.ok(buf.length > 1000, 'PDF too small size=' + buf.length);
  console.log('SUCCESS client invoice PDF size =', buf.length);
  if (devProc) devProc.kill('SIGINT');
}

run().catch(e => { console.error('FAIL', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
