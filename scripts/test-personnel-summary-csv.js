#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const res = await fetch('http://localhost:3000/api/personnel/summary?format=csv');
  assert(res.ok, 'summary CSV endpoint failed');
  const text = await res.text();
  assert(text.startsWith('headcount_total,'), 'CSV header unexpected');
  const lines = text.trim().split('\n');
  assert(lines.length === 2, 'Expected single data row');
  const headerCols = lines[0].split(',');
  const dataCols = lines[1].split(',');
  assert(headerCols.length === dataCols.length, 'Header/data column mismatch');
  // Basic numeric check for headcount_total
  const headcountTotal = Number(dataCols[0].replace(/"/g,''));
  assert(!Number.isNaN(headcountTotal), 'headcount_total not numeric');
  console.log('Personnel summary CSV OK');
}

main().catch(e => { console.error(e); process.exit(1); });
