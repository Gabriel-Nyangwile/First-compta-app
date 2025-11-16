#!/usr/bin/env node
// Basic sanity test for IPR calculation on current active employees.
import prisma from '../src/lib/prisma.js';
import { calculatePayslipForEmployee } from '../src/lib/payroll/engine.js';

async function main() {
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' }, include: { position: { include: { bareme: true } } } });
  if (!employees.length) { console.log('No ACTIVE employees'); return; }
  let failures = 0;
  for (const e of employees) {
    const calc = await calculatePayslipForEmployee(e);
    const iprLine = calc.lines.find(l => l.code === 'IPR');
    const cnssEmp = calc.lines.find(l => l.code === 'CNSS_EMP');
    const ri = iprLine?.baseAmount ?? 0;
    const ipr = iprLine ? Math.abs(iprLine.amount) : 0;
    // Ratio checks
    const ratio = ri > 0 ? ipr / ri : 0;
    if (ratio > 0.35) { console.log(`FAIL high ratio employee=${e.id} ratio=${(ratio*100).toFixed(2)}% ri=${ri} ipr=${ipr}`); failures++; }
    if (ipr > ri) { console.log(`FAIL ipr>ri employee=${e.id} ri=${ri} ipr=${ipr}`); failures++; }
    if (ipr < 0) { console.log(`FAIL negative ipr employee=${e.id} ipr=${ipr}`); failures++; }
    // Net positive check
    if (calc.netAmount <= 0) { console.log(`FAIL net <=0 employee=${e.id} net=${calc.netAmount}`); failures++; }
  }
  if (failures === 0) console.log('IPR sanity PASS'); else console.log(`IPR sanity FAIL count=${failures}`);
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
