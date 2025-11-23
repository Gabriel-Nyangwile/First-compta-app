#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const res = await fetch('http://localhost:3000/api/payroll/periods/years');
  assert(res.ok, 'years endpoint failed');
  const json = await res.json();
  assert(json.ok, 'ok flag false');
  assert(Array.isArray(json.years), 'years not array');
  let prev = null;
  for(const y of json.years){
    assert(typeof y === 'number', 'year not number');
    if(prev!==null) assert(y >= prev, 'years not ascending');
    prev = y;
  }
  console.log('Payroll years endpoint OK');
}

main().catch(e => { console.error(e); process.exit(1); });