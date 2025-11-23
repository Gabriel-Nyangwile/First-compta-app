#!/usr/bin/env node
// Test period summary API JSON & CSV
import 'dotenv/config';
import assert from 'assert';

async function ensurePeriod(base) {
  let res = await fetch(base + '/api/payroll/periods');
  const list = await res.json();
  if (!res.ok) throw new Error('List periods failed: ' + res.status);
  if (list.periods.length) return list.periods[0];
  const now = new Date();
  res = await fetch(base + '/api/payroll/period', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ month: now.getMonth()+1, year: now.getFullYear() }) });
  const created = await res.json();
  if (!res.ok) throw new Error('Create period failed: ' + JSON.stringify(created));
  return created.period;
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const period = await ensurePeriod(base);
  // JSON
  let res = await fetch(base + `/api/payroll/period/${period.id}/summary`);
  let json = await res.json();
  if (!res.ok) throw new Error('Summary JSON failed: ' + JSON.stringify(json));
  assert.ok(json.ok, 'ok true');
  assert.ok(json.period && json.period.ref === period.ref, 'period ref matches');
  assert.ok(json.totals && typeof json.totals.grossTotal === 'number', 'grossTotal numeric');
  assert.ok(Array.isArray(json.employees), 'employees array');
  if (json.employees.length) {
    const e = json.employees[0];
    for (const f of ['gross','net','cnssEmployee','iprTax','employerCharges']) {
      assert.ok(typeof e[f] === 'number', `employee field ${f}`);
    }
  }
  console.log('JSON summary OK');
  // CSV
  res = await fetch(base + `/api/payroll/period/${period.id}/summary?format=csv`);
  const csv = await res.text();
  if (!res.ok) throw new Error('Summary CSV failed: ' + res.status);
  const header = csv.split('\n')[0];
  const expectedCols = ['ref','employeeName','gross','net','cnssEmployee','iprTax','cnssEmployer','onem','inpp','overtime','employerCharges','linesCount'];
  for (const c of expectedCols) assert.ok(header.includes(c), 'CSV header includes ' + c);
  console.log('CSV summary OK');
}

main().catch(e => { console.error(e); process.exit(1); });
