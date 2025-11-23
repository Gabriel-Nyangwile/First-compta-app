#!/usr/bin/env node
import assert from 'assert';
import fs from 'fs';

async function main(){
  const year = new Date().getFullYear();
  const res = await fetch(`http://localhost:3000/api/payroll/periods/annual-summary?year=${year}`);
  assert(res.ok, 'annual summary endpoint failed');
  const json = await res.json();
  assert(json.ok, 'response ok flag false');
  assert(json.months.length <= 12, 'Too many months');
  let prevGross = 0; let prevNet = 0;
  for(const m of json.months){
    assert(m.ytdGross >= prevGross, 'YTD gross not monotonic');
    assert(m.ytdNet >= prevNet, 'YTD net not monotonic');
    prevGross = m.ytdGross; prevNet = m.ytdNet;
  }
  // CSV check
  const csvRes = await fetch(`http://localhost:3000/api/payroll/periods/annual-summary?year=${year}&format=csv`);
  assert(csvRes.ok, 'CSV fetch failed');
  const csvText = await csvRes.text();
  assert(csvText.startsWith('month,'), 'CSV header unexpected');
  console.log('Annual payroll summary OK');
}

main().catch(e => { console.error(e); process.exit(1); });
