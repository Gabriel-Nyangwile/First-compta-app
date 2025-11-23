#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const nowYear = new Date().getFullYear();
  const from = nowYear - 1; // previous year if exists
  const url = `http://localhost:3000/api/payroll/periods/trend?from=${from}&to=${nowYear}`;
  const res = await fetch(url);
  assert(res.ok, 'trend endpoint failed');
  const json = await res.json();
  assert(json.ok, 'ok flag false');
  assert(json.from === from, 'from year mismatch');
  assert(json.to === nowYear, 'to year mismatch');
  assert(Array.isArray(json.years), 'years not array');
  assert(json.years.length >= 1, 'empty years');
  let prevYear = null;
  for(const y of json.years){
    assert(typeof y.year === 'number', 'year missing');
    if(prevYear!==null) assert(y.year > prevYear, 'years not strictly ascending');
    prevYear = y.year;
    const t = y.totals;
    for(const k of ['gross','net','cnssSal','ipr','cnssEmp','onem','inpp','charges','ot','corrGross','corrNet']){
      assert(k in t, `missing total key ${k}`);
      assert(typeof t[k] === 'number', `total key ${k} not number`);
    }
  }
  console.log('Payroll trend endpoint OK');
}

main().catch(e => { console.error(e); process.exit(1); });