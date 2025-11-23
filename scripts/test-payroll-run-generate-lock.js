#!/usr/bin/env node
// Smoke test: generate payslips then lock period.
// Usage: node scripts/test-payroll-run-generate-lock.js
import 'dotenv/config';
import assert from 'assert';

async function jsonOrThrow(res, label){
  const j = await res.json();
  if(!res.ok) throw new Error(label+': '+JSON.stringify(j));
  return j;
}

async function main(){
  const base = process.env.BASE_URL || 'http://localhost:3000';
  // 1. Ensure OPEN period
  let res = await fetch(base + '/api/payroll/periods?status=OPEN');
  let listing = await jsonOrThrow(res, 'list periods');
  let periodId;
  if(!listing.periods.length){
    const now = new Date();
    res = await fetch(base + '/api/payroll/period', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ month: now.getMonth()+1, year: now.getFullYear() }) });
    const created = await jsonOrThrow(res, 'create period');
    periodId = created.period.id;
  } else {
    periodId = listing.periods[0].id;
  }
  console.log('Using period', periodId);
  // 2. Preview (optional) to ensure employees accessible
  res = await fetch(base + `/api/payroll/period/${periodId}/preview`);
  const preview = await jsonOrThrow(res, 'preview');
  console.log('Preview count', preview.count);
  // 3. Generate payslips
  res = await fetch(base + `/api/payroll/period/${periodId}/generate`, { method:'POST' });
  const gen = await jsonOrThrow(res, 'generate');
  console.log('Generated payslips', gen.count);
  assert.ok(gen.count >= 0, 'generated count >= 0');
  // 4. Lock period (only if there are payslips; if none generation created zero -> skip lock expectation)
  if(gen.count > 0){
    res = await fetch(base + `/api/payroll/period/${periodId}/lock`, { method:'POST' });
    const lock = await jsonOrThrow(res, 'lock');
    console.log('Locked ref', lock.periodRef);
    assert.ok(lock.ok, 'lock ok');
  } else {
    console.log('No payslips generated; skipping lock (acceptable if no active employees).');
  }
  // 5. List all periods and verify status if locked
  res = await fetch(base + '/api/payroll/periods');
  listing = await jsonOrThrow(res, 'list all periods');
  const p = listing.periods.find(p => p.id === periodId);
  if(gen.count > 0){
    assert.ok(p.status === 'LOCKED', 'period locked status');
  }
  console.log('OK');
}

main().catch(e => { console.error(e); process.exit(1); });
