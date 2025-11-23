#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const ps = await prisma.payslip.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!ps) { console.log('[pdf-smoke] No payslip found'); process.exit(0); }
  const url = `http://localhost:3000/api/payroll/payslips/${ps.id}/pdf`;
  const res = await fetch(url);
  console.log('[pdf-smoke] HTTP', res.status);
  if (res.status !== 200) {
    const txt = await res.text();
    console.log('[pdf-smoke] Body:', txt.slice(0, 200));
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const magic = buf.slice(0, 4).toString('ascii');
  console.log('[pdf-smoke] Magic:', magic);
  if (magic !== '%PDF') process.exit(2);
  console.log('[pdf-smoke] OK');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
