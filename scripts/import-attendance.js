#!/usr/bin/env node
// Usage: node scripts/import-attendance.js <csv-path>
// CSV columns: periodRef,employeeNumber,daysWorked,workingDays,overtimeHours,notes

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
      await prisma.employeeAttendance.upsert({
        where: { periodId_employeeId: { periodId: period.id, employeeId: emp.id } },
        update: { daysWorked: num(r.daysWorked), workingDays: num(r.workingDays), overtimeHours: num(r.overtimeHours), notes: r.notes || null },
        create: { periodId: period.id, employeeId: emp.id, daysWorked: num(r.daysWorked), workingDays: num(r.workingDays), overtimeHours: num(r.overtimeHours), notes: r.notes || null },
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
