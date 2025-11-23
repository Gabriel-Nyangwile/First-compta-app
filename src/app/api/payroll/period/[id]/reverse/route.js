import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { reversePayrollPeriod } from '@/lib/payroll/postings';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const period = await prisma.payrollPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  if (period.status !== 'POSTED') return NextResponse.json({ error: `Must be POSTED (status=${period.status})` }, { status: 409 });
  try {
    let actor = null;
    try {
      // Try extract simple actor identity from headers (optional)
      actor = req.headers.get('x-user') || req.headers.get('x-actor') || null;
    } catch { /* noop */ }
    const { journal, reversedCount, debit, credit } = await reversePayrollPeriod(period.id, actor);
    const after = await prisma.payrollPeriod.findUnique({ where: { id } });
    return NextResponse.json({ ok: true, periodId: id, periodRef: period.ref, journalNumber: journal.number, reversedCount, debit, credit, newStatus: after.status });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Reverse failed' }, { status: 500 });
  }
}
