#!/usr/bin/env node
// Simple smoke test for payroll run preview
// Usage: node scripts/test-payroll-run-preview.js

import 'dotenv/config';
import assert from 'assert';

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  // Ensure payroll module enabled assumption
  console.log('Fetching OPEN periods...');
  let res = await fetch(base + '/api/payroll/periods?status=OPEN');
  if (!res.ok) throw new Error('Failed list periods: ' + res.status);
  let json = await res.json();
  let periodId;
  if (json.periods.length === 0) {
    console.log('No OPEN period – creating current');
    const now = new Date();
    res = await fetch(base + '/api/payroll/period', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ month: now.getMonth()+1, year: now.getFullYear() }) });
    const created = await res.json();
    if (!res.ok) throw new Error('Create period failed: ' + JSON.stringify(created));
    periodId = created.period.id;
  } else {
    periodId = json.periods[0].id;
  }
  console.log('Previewing period', periodId);
  res = await fetch(base + `/api/payroll/period/${periodId}/preview`);
  const preview = await res.json();
  if (!res.ok) throw new Error('Preview failed: ' + JSON.stringify(preview));
  assert.ok(preview.ok, 'preview.ok');
  assert.ok('count' in preview, 'preview.count present');
  console.log('Preview employees count:', preview.count);
  if (preview.count > 0) {
    const first = preview.results[0];
    assert.ok(typeof first.gross === 'number', 'gross is number');
    assert.ok(typeof first.net === 'number', 'net is number');
    assert.ok(Array.isArray(first.lines), 'lines array');
  } else {
    console.log('No active employees – preview empty (acceptable).');
  }
  console.log('OK');
}

main().catch(e => { console.error(e); process.exit(1); });
