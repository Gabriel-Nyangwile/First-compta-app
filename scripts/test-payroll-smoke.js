// Simple smoke test for payroll period APIs: create -> generate -> lock
// Usage: node scripts/test-payroll-smoke.js [year] [month]

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      // Consider server ready if any HTTP response is received (server reachable)
      return true;
    } catch (e) {
      // ignore until timeout
    }
    await wait(500);
  }
  throw new Error(`Server not responding at ${url}`);
}

async function run() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const year = Number(process.argv[2] || 2025);
  const month = Number(process.argv[3] || 10);

  console.log(`[payroll-smoke] Waiting for server at ${baseUrl} ...`);
  await waitForServer(baseUrl + '/');

  const base = baseUrl + '/api/payroll/period';
  console.log(`[payroll-smoke] Creating period ${year}-${String(month).padStart(2, '0')}`);
  const createRes = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year, month }),
  });
  const createJson = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    console.error('[payroll-smoke] Create failed', createRes.status, createJson);
    process.exit(1);
  }
  const periodId = createJson?.period?.id;
  const periodRef = createJson?.period?.ref;
  if (!periodId) {
    console.error('[payroll-smoke] No period id in response', createJson);
    process.exit(2);
  }
  console.log(`[payroll-smoke] Created period id=${periodId} ref=${periodRef}`);

  console.log('[payroll-smoke] Generating payslips ...');
  const genRes = await fetch(`${base}/${periodId}/generate`, { method: 'POST' });
  const genJson = await genRes.json().catch(() => ({}));
  if (!genRes.ok) {
    console.error('[payroll-smoke] Generate failed', genRes.status, genJson);
    process.exit(3);
  }
  console.log(`[payroll-smoke] Generated payslips count=${genJson?.count ?? 'n/a'}`);

  console.log('[payroll-smoke] Locking period ...');
  const lockRes = await fetch(`${base}/${periodId}/lock`, { method: 'POST' });
  const lockJson = await lockRes.json().catch(() => ({}));
  if (!lockRes.ok) {
    console.error('[payroll-smoke] Lock failed', lockRes.status, lockJson);
    process.exit(4);
  }
  const status = lockJson?.status || lockJson?.period?.status;
  console.log(`[payroll-smoke] Locked. status=${status}`);

  console.log('[payroll-smoke] OK');
}

run().catch((e) => {
  console.error('[payroll-smoke] ERROR', e?.message || e);
  process.exit(99);
});
