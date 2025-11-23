#!/usr/bin/env node
// Detailed smoke test for enhanced payroll preview endpoint
// Usage: node scripts/test-payroll-run-preview-detail.js

import 'dotenv/config';
import assert from 'assert';

async function ensureOpenPeriod(base) {
  let res = await fetch(base + '/api/payroll/periods?status=OPEN');
  if (!res.ok) throw new Error('List OPEN periods failed: ' + res.status);
  const json = await res.json();
  if (json.periods.length) return json.periods[0].id;
  const now = new Date();
  res = await fetch(base + '/api/payroll/period', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ month: now.getMonth()+1, year: now.getFullYear() }) });
  const created = await res.json();
  if (!res.ok) throw new Error('Create period failed: ' + JSON.stringify(created));
  return created.period.id;
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const periodId = await ensureOpenPeriod(base);
  console.log('Using period', periodId);
  const res = await fetch(base + `/api/payroll/period/${periodId}/preview`);
  const preview = await res.json();
  if (!res.ok) throw new Error('Preview failed: ' + JSON.stringify(preview));
  assert.ok(preview.ok, 'preview.ok');
  assert.ok(Array.isArray(preview.results), 'results array');
  if (preview.results.length === 0) {
    console.log('No employees active; empty preview acceptable.');
  } else {
    const r = preview.results[0];
    const numericFields = ['gross','net','cnssEmployee','iprTax','employerCharges','cnssEmployer','onem','inpp'];
    for (const f of numericFields) {
      assert.ok(typeof r[f] === 'number', `Field ${f} numeric`);
    }
    // Optional numeric (riBase may be null if tax line missing)
    if (r.riBase != null) assert.ok(typeof r.riBase === 'number', 'riBase numeric');
    if (r.fxRate != null) assert.ok(typeof r.fxRate === 'number', 'fxRate numeric');
    assert.ok(Array.isArray(r.lines) && r.lines.length > 0, 'lines present');
    // Check one known code exists
    const hasBase = r.lines.some(l => l.code === 'BASE');
    assert.ok(hasBase, 'BASE line exists');
  }
  console.log('Enhanced preview details OK');
}

main().catch(e => { console.error(e); process.exit(1); });
