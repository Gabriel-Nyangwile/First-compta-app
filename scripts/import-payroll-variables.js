#!/usr/bin/env node
// Usage: node scripts/import-payroll-variables.js <csv-path>
// CSV columns: periodRef,employeeNumber,kind,label,amount,costCenterCode

import fs from 'fs';
import prisma from '../src/lib/prisma.js';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',').map(s => s.trim());
  return lines.map(line => {
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(cur); cur = ''; } else { cur += c; }
    }
    cols.push(cur);
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (cols[i] ?? '').trim();
    return row;
  });
}

function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('CSV path required'); process.exit(1); }
  const csv = fs.readFileSync(file, 'utf-8');
  const rows = parseCSV(csv);
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const period = await prisma.payrollPeriod.findUnique({ where: { ref: r.periodRef } });
      if (!period) throw new Error(`period ${r.periodRef} not found`);
      const emp = await prisma.employee.findFirst({ where: { employeeNumber: r.employeeNumber } });
      if (!emp) throw new Error(`employee ${r.employeeNumber} not found`);
      const cc = r.costCenterCode ? await prisma.costCenter.findFirst({ where: { code: r.costCenterCode } }) : null;
      await prisma.payrollVariable.create({
        data: {
          periodId: period.id,
          employeeId: emp.id,
          kind: r.kind,
          label: r.label || r.kind,
          amount: num(r.amount) ?? 0,
          costCenterId: cc?.id ?? null,
        }
      });
      ok++;
    } catch (e) {
      console.error('Row error', r, e.message);
      fail++;
    }
  }
  console.log(JSON.stringify({ ok, fail }));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
