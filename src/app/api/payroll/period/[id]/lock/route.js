import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';

export const dynamic = 'force-dynamic';

export async function POST(_req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const period = await prisma.payrollPeriod.findUnique({ where: { id }, include: { payslips: true } });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  if (period.status !== 'OPEN') return NextResponse.json({ error: `Cannot lock status=${period.status}` }, { status: 409 });
  if (!period.payslips.length) return NextResponse.json({ error: 'No payslips to lock' }, { status: 422 });
  const netTotal = period.payslips.reduce((s, p) => s + (p.netAmount?.toNumber?.() ?? Number(p.netAmount) ?? 0), 0);
  if (!(netTotal > 0)) return NextResponse.json({ error: `Aggregated net <=0 (${netTotal.toFixed(2)})` }, { status: 422 });
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.payrollPeriod.update({ where: { id }, data: { status: 'LOCKED', lockedAt: now } });
      await tx.payslip.updateMany({ where: { periodId: id }, data: { locked: true } });
    });
    return NextResponse.json({ ok: true, periodId: id, periodRef: period.ref, lockedAt: now.toISOString(), payslipsLocked: period.payslips.length });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Lock failed' }, { status: 500 });
  }
}
