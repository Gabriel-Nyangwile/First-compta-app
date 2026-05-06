import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { featureFlags } from '@/lib/features';
import { postPayrollPeriod } from '@/lib/payroll/postings';
import { getRequestRole } from '@/lib/requestAuth';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm("approvePayroll", role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const period = await prisma.payrollPeriod.findUnique({ where: { id, companyId }, include: { payslips: true } });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  if (period.status === 'POSTED') return NextResponse.json({ error: 'Already posted' }, { status: 409 });
  if (period.status !== 'LOCKED') return NextResponse.json({ error: `Must be LOCKED (status=${period.status})` }, { status: 409 });
  if (!period.payslips.length) return NextResponse.json({ error: 'No payslips' }, { status: 422 });
  try {
    const { journal, transactions, debit, credit } = await postPayrollPeriod(period.id, companyId);
    return NextResponse.json({
      ok: true,
      periodId: period.id,
      periodRef: period.ref,
      journalId: journal.id,
      journalNumber: journal.number,
      transactions: transactions.length,
      debit: Number(debit.toFixed(2)),
      credit: Number(credit.toFixed(2)),
      postedAt: journal.date?.toISOString?.() || new Date().toISOString()
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Post failed' }, { status: 500 });
  }
}
