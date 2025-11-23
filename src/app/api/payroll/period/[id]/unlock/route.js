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
  if (period.status !== 'LOCKED') return NextResponse.json({ error: `Must be LOCKED (status=${period.status})` }, { status: 409 });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.payrollPeriod.update({ where: { id }, data: { status: 'OPEN', lockedAt: null, postedAt: null } });
      await tx.payslip.updateMany({ where: { periodId: id }, data: { locked: false } });
    });
    return NextResponse.json({ ok: true, periodId: id, periodRef: period.ref, unlocked: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Unlock failed' }, { status: 500 });
  }
}