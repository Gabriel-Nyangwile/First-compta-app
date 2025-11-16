#!/usr/bin/env node
// Sanity check: with FX rates, ensure IPR ratio computed in CDF stays <= configured cap and back-converted net positive.
import prisma from '../src/lib/prisma.js';
import { calculatePayslipForEmployee } from '../src/lib/payroll/engine.js';

async function main() {
  const period = await prisma.payrollPeriod.findFirst({ orderBy: { openedAt: 'desc' } });
  const context = period || { year: 2026, month: 6 };
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' }, include: { position: { include: { bareme: true } } } });
  if (!employees.length) { console.log('No employees'); return; }
  let fails = 0;
  for (const e of employees) {
    const calc = await calculatePayslipForEmployee(e, context);
    const iprLine = calc.lines.find(l => l.code === 'IPR');
    const riBase = iprLine?.baseAmount ?? 0;
    const fxRate = iprLine?.meta?.fxRate ?? 1;
    const riCDF = iprLine?.meta?.riCDF ?? riBase * fxRate;
    const iprCDF = iprLine?.meta?.iprCDF ?? Math.abs(iprLine?.amount ?? 0) * fxRate;
    const ratio = riCDF > 0 ? iprCDF / riCDF : 0;
    if (ratio > 0.31) { console.log(`FAIL ratio>${(0.31*100).toFixed(2)}% emp=${e.id} ratio=${(ratio*100).toFixed(2)} riCDF=${riCDF} iprCDF=${iprCDF}`); fails++; }
    if (calc.netAmount <= 0) { console.log(`FAIL net<=0 emp=${e.id} net=${calc.netAmount}`); fails++; }
  }
  console.log(fails === 0 ? 'FX IPR sanity PASS' : `FX IPR sanity FAIL count=${fails}`);
  await prisma.$disconnect();
}

main().catch(async e=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
