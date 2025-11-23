#!/usr/bin/env node
// Smoke test for period totals summary aggregation
// Usage: node scripts/test-payroll-period-summary.js
import 'dotenv/config';
import assert from 'assert';

async function ensureOpenOrAnyPeriod(base) {
  let res = await fetch(base + '/api/payroll/periods');
  if (!res.ok) throw new Error('List periods failed: ' + res.status);
  const all = await res.json();
  if (all.periods.length) return all.periods[0];
  const now = new Date();
  res = await fetch(base + '/api/payroll/period', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ month: now.getMonth()+1, year: now.getFullYear() }) });
  const created = await res.json();
  if (!res.ok) throw new Error('Create period failed: ' + JSON.stringify(created));
  return created.period;
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const period = await ensureOpenOrAnyPeriod(base);
  // Fetch HTML page and do a coarse check for totals section markers.
  const res = await fetch(base + `/payroll/periods/${period.ref}`);
  const html = await res.text();
  if (!res.ok) throw new Error('Period page fetch failed: ' + res.status);
  // Check presence of key labels
  const markers = ['Totaux période', 'Brut total:', 'Net total:', 'CNSS salarié total:', 'Charges employeur totales:'];
  for (const m of markers) {
    assert.ok(html.includes(m), 'HTML contains marker: ' + m);
  }
  console.log('Period summary markers present. OK');
}

main().catch(e => { console.error(e); process.exit(1); });
