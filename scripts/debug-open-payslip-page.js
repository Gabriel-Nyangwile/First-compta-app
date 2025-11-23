#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const ps = await prisma.payslip.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!ps) { console.log('No payslip found'); process.exit(0); }
  console.log('Payslip id:', ps.id, 'ref:', ps.ref);
  const url = `http://localhost:3000/payroll/payslips/${ps.id}`;
  const res = await fetch(url);
  console.log('HTTP', res.status);
  const txt = await res.text();
  console.log('Body preview:', txt.slice(0, 160));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
