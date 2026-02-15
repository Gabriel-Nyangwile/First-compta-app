import { NextResponse } from 'next/server';
import { featureFlags } from '@/lib/features';
import { recalculatePayslip } from '@/lib/payroll/engine';
import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const ps = await prisma.payslip.findUnique({ where: { id, companyId }, include: { period: true } });
    if (!ps) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    if (ps.period?.status !== 'OPEN') {
      return NextResponse.json({ error: `Recalcul interdit: période ${ps.period?.status}` }, { status: 409 });
    }
    const res = await recalculatePayslip(id, companyId);
    return NextResponse.json({ ok: true, gross: res.grossAmount, net: res.netAmount, lines: res.lines.length });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Recalc failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
