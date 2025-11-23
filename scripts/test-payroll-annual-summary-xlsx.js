#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const year = new Date().getFullYear();
  const res = await fetch(`http://localhost:3000/api/payroll/periods/annual-summary/xlsx?year=${year}`);
  assert(res.ok, 'annual XLSX endpoint failed');
  const buf = new Uint8Array(await res.arrayBuffer());
  const sig = new TextDecoder().decode(buf.slice(0,2));
  assert(sig === 'PK', 'XLSX zip signature missing');
  console.log('Annual payroll XLSX OK');
}

main().catch(e => { console.error(e); process.exit(1); });