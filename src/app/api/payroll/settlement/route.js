import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { postPayrollSettlement } from '@/lib/payroll/settlement';

export const dynamic = 'force-dynamic';

// POST /api/payroll/settlement
// body: { periodId OR periodRef, accountNumber?, dryRun? }
export async function POST(req) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  try {
    const body = await req.json();
    const { periodId, periodRef, accountNumber, dryRun } = body || {};
    if (!periodId && !periodRef) return NextResponse.json({ error: 'periodId or periodRef required' }, { status: 400 });
    const period = periodId
      ? await prisma.payrollPeriod.findUnique({ where: { id: periodId } })
      : await prisma.payrollPeriod.findUnique({ where: { ref: periodRef } });
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    const res = await postPayrollSettlement(period.id, { accountNumber, dryRun });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('payroll settlement error', e);
    return NextResponse.json({ error: e.message || 'Settlement failed' }, { status: 500 });
  }
}
