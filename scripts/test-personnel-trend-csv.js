#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const token = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  const res = await fetch('http://localhost:3000/api/personnel/trend?format=csv&months=6', { headers: token ? { 'x-admin-token': token } : {} });
  assert(res.ok, 'trend CSV endpoint failed');
  const text = await res.text();
  assert(text.startsWith('year,month,activeStart,'), 'Trend CSV header unexpected');
  const lines = text.trim().split('\n');
  assert(lines.length >= 2, 'No data rows');
  // Check first data row numeric columns
  const firstData = lines[1].split(',').map(c => c.replace(/"/g,''));
  const year = Number(firstData[0]);
  const activeStart = Number(firstData[2]);
  const activeEnd = Number(firstData[3]);
  assert(!Number.isNaN(year) && year >= 2000, 'Invalid year');
  assert(!Number.isNaN(activeStart) && activeStart >= 0, 'Invalid activeStart');
  assert(!Number.isNaN(activeEnd) && activeEnd >= 0, 'Invalid activeEnd');
  console.log('Personnel trend CSV OK');
}

main().catch(e => { console.error(e); process.exit(1); });
