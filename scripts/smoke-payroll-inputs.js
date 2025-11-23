#!/usr/bin/env node
// Quick smoke: list attendance and variables for latest period

import prisma from '../src/lib/prisma.js';

async function main() {
  const period = await prisma.payrollPeriod.findFirst({ orderBy: { openedAt: 'desc' } });
  if (!period) { console.error('No payroll period'); process.exit(1); }
  const attendance = await prisma.employeeAttendance.findMany({ where: { periodId: period.id } });
  const variables = await prisma.payrollVariable.findMany({ where: { periodId: period.id } });
  console.log(JSON.stringify({ period: { id: period.id, ref: period.ref, status: period.status }, attendance: attendance.length, variables: variables.length }));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
