#!/usr/bin/env node
// Test PDF summary endpoint: checks PDF header signature
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
  const res = await fetch(base + `/api/payroll/period/${period.id}/summary/pdf`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!res.ok) throw new Error('PDF endpoint failed: ' + res.status);
  const header = new TextDecoder().decode(buf.slice(0, 8));
  assert.ok(header.startsWith('%PDF-'), 'PDF header missing');
  console.log('PDF summary OK');
}

main().catch(e => { console.error(e); process.exit(1); });
