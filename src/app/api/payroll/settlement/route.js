import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { featureFlags } from '@/lib/features';
import { postPayrollSettlement } from '@/lib/payroll/settlement';
import { getRequestRole } from '@/lib/requestAuth';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

  // POST /api/payroll/settlement
  // body: { periodId OR periodRef, accountNumber?, dryRun?, employeeId? }
export async function POST(req) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm("approvePayroll", role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { periodId, periodRef, accountNumber, dryRun, employeeId, liabilityCode } = body || {};
    if (!periodId && !periodRef) return NextResponse.json({ error: 'periodId or periodRef required' }, { status: 400 });
    const period = periodId
      ? await prisma.payrollPeriod.findUnique({ where: { id: periodId, companyId } })
      : await prisma.payrollPeriod.findFirst({ where: { ref: periodRef, companyId } });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    const res = await postPayrollSettlement(period.id, { accountNumber, dryRun, employeeId, companyId, liabilityCode });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('payroll settlement error', e);
    const msg = e?.message || 'Settlement failed';
    const lower = msg.toLowerCase();
    const status = lower.includes('posted') ? 409
      : lower.includes('already fully settled') ? 409
      : lower.includes('already settled globally') ? 409
      : lower.includes('employee already settled') ? 409
      : lower.includes('employee-level settlement not supported') ? 409
      : lower.includes('net total') ? 422
      : lower.includes('total <= 0') ? 422
      : lower.includes('not found') ? 404
      : lower.includes('missing payroll account mapping') ? 400
      : lower.includes('unsupported payroll liability code') ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
