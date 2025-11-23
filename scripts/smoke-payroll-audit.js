#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const posted = await prisma.payrollPeriod.findFirst({ where: { status: 'POSTED' }, orderBy: { postedAt: 'desc' } });
  if (!posted) { console.log('[audit-smoke] No POSTED period'); await prisma.$disconnect(); return; }
  const port = process.env.PORT || '3000';
  const url = `http://localhost:${port}/api/payroll/period/${posted.id}/audit`;
  console.log('[audit-smoke] GET', url);
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  const ct = res.headers.get('content-type') || '';
  console.log('[audit-smoke] HTTP', res.status, 'period', posted.ref, 'content-type', ct);
  if (!ct.includes('application/json')) {
    const txt = await res.text();
    console.log('[audit-smoke] non-JSON response sample:', txt.slice(0,200));
  } else {
    const json = await res.json();
    console.log('[audit-smoke] ok=', json.ok, 'journal=', json.journalNumber, 'balanced=', json.balanced, 'mismatches=', json.mismatchCount);
    console.log('[audit-smoke] rows sample:', Array.isArray(json.rows) ? json.rows.slice(0,3) : json.rows);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
