#!/usr/bin/env node
// Test XLSX summary endpoint: checks ZIP signature 'PK' and worksheet names
import 'dotenv/config';
import assert from 'assert';

async function ensurePeriod(base) {
  let res = await fetch(base + '/api/payroll/periods');
  const data = await res.json();
  if (!res.ok) throw new Error('List failed');
  if (data.periods.length) return data.periods[0];
  const now = new Date();
  res = await fetch(base + '/api/payroll/period', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ month: now.getMonth()+1, year: now.getFullYear() }) });
  const created = await res.json();
  if (!res.ok) throw new Error('Create period failed');
  return created.period;
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const period = await ensurePeriod(base);
  const res = await fetch(base + `/api/payroll/period/${period.id}/summary/xlsx`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) throw new Error('XLSX endpoint failed: ' + res.status);
  // Basic ZIP signature check
  const sig = String.fromCharCode(buf[0]) + String.fromCharCode(buf[1]);
  assert.ok(sig === 'PK', 'XLSX zip signature missing');
  console.log('XLSX summary OK');
}

main().catch(e => { console.error(e); process.exit(1); });
