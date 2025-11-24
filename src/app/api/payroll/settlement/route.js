import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { postPayrollSettlement } from '@/lib/payroll/settlement';

export const dynamic = 'force-dynamic';

  // POST /api/payroll/settlement
  // body: { periodId OR periodRef, accountNumber?, dryRun?, employeeId? }
export async function POST(req) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  try {
    const body = await req.json();
    const { periodId, periodRef, accountNumber, dryRun, employeeId } = body || {};
    if (!periodId && !periodRef) return NextResponse.json({ error: 'periodId or periodRef required' }, { status: 400 });
    const period = periodId
      ? await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
      : await prisma.payrollPeriod.findUnique({ where: { ref: periodRef } });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    const res = await postPayrollSettlement(period.id, { accountNumber, dryRun, employeeId });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('payroll settlement error', e);
    const msg = e?.message || 'Settlement failed';
    const lower = msg.toLowerCase();
    const status = lower.includes('posted') ? 409
      : lower.includes('net total') ? 422
      : lower.includes('not found') ? 404
      : lower.includes('missing payroll account mapping') ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
