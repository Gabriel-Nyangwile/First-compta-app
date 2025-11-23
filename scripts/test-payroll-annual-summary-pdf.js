#!/usr/bin/env node
import assert from 'assert';

async function main(){
  const year = new Date().getFullYear();
  const res = await fetch(`http://localhost:3000/api/payroll/periods/annual-summary/pdf?year=${year}`);
  assert(res.ok, 'annual PDF endpoint failed');
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder().decode(buf.slice(0,5));
  assert(head === '%PDF-', 'PDF header missing');
  console.log('Annual payroll PDF OK');
}

main().catch(e => { console.error(e); process.exit(1); });