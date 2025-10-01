#!/usr/bin/env node
/**
 * Enhanced PDF smoke test (A+B):
 *  - Optional auto start dev server (--start-server)
 *  - Retry logic (--retries N, --retry-delay ms)
 *  - Configurable base URL via PDF_BASE_URL env or --base-url
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

async function ensureSampleIncomingInvoice() {
  const existing = await prisma.incomingInvoice.findFirst({ select: { id: true } });
  if (existing) return existing.id;
  const supplier = await prisma.supplier.findFirst({});
  const account = await prisma.account.findFirst({});
  if (!supplier || !account) throw new Error('Need at least one supplier + account');
  const created = await prisma.incomingInvoice.create({
    data: {
      entryNumber: 'EI-TEST-' + Date.now(),
      supplierInvoiceNumber: 'SUP-' + Date.now(),
      supplierId: supplier.id,
      totalAmount: 0,
      totalAmountHt: 0,
      vat: 0,
      vatAmount: 0,
      lines: { create: [{ description: 'Ligne test', accountId: account.id, unitOfMeasure: 'U', quantity: '1', unitPrice: '0', lineTotal: '0' }] }
    }
  });
  return created.id;
}

async function waitForServer(baseUrl, { timeoutMs = 90000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  const healthUrl = `${baseUrl}/api/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
      if (r.ok) {
        try {
          const data = await r.json();
          if (data && data.ok) return true;
        } catch { /* JSON parse ignore */ }
      }
    } catch { /* swallow */ }
    await delay(intervalMs);
  }
  throw new Error(`Server not healthy at ${healthUrl} after ${(timeoutMs/1000)}s`);
}

async function fetchWithRetry(url, { retries, retryDelay }) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      const wait = retryDelay * Math.pow(1.5, attempt);
      console.log(`Retry ${attempt+1}/${retries} after error: ${e.message} (waiting ${Math.round(wait)}ms)`);
      await delay(wait);
    }
    attempt++;
  }
  throw lastErr || new Error('Unknown fetch error');
}

async function run() {
  const opts = parseArgs();
  console.log('Options:', opts);
  const id = await ensureSampleIncomingInvoice();
  const pdfUrl = `${opts.baseUrl}/api/incoming-invoices/${id}/pdf`;

  let devProc = null;
  // Detect server availability using explicit health endpoint
  let serverUp = false;
  try {
    const h = await fetch(`${opts.baseUrl}/api/health`, { cache: 'no-store' });
    if (h.ok) {
      const j = await h.json().catch(()=>null);
      serverUp = !!(j && j.ok);
    }
  } catch { serverUp = false; }
  if (!serverUp && opts.startServer) {
    console.log('Starting dev server...');
    devProc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','dev'], { stdio: 'pipe', env: process.env });
    devProc.stdout.on('data', d => {
      const line = d.toString();
      if (line.toLowerCase().includes('ready') || line.toLowerCase().includes('started server')) {
        // heuristic only
      }
    });
    devProc.stderr.on('data', d => {
      // silence or log minimal
    });
  await waitForServer(opts.baseUrl);
  } else if (!serverUp && !opts.startServer) {
    throw new Error('Server not running and --start-server not provided');
  }

  const res = await fetchWithRetry(pdfUrl, { retries: opts.retries, retryDelay: opts.retryDelay });
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('application/pdf'), 'Content-Type should be application/pdf, got ' + ct);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.ok(buf.length > 1000, 'PDF too small, size=' + buf.length);
  console.log('SUCCESS incoming invoice PDF size =', buf.length);

  if (devProc) {
    devProc.kill('SIGINT');
  }
}

run().catch(e => { console.error('FAIL', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
