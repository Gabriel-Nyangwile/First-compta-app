import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { requireCompanyId } from '@/lib/tenant';
import { listPayrollSettlements } from '@/lib/payroll/settlement';

export const dynamic = 'force-dynamic';

function toNum(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing period id' }, { status: 400 });
  const period = await prisma.payrollPeriod.findUnique({ where: { id, companyId } });
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 });
  if (period.status !== 'POSTED') return NextResponse.json({ error: `Period must be POSTED (status=${period.status})` }, { status: 409 });

  const url = new URL(req.url);
  const employeeFilter = url.searchParams.get('employeeId');
  const format = url.searchParams.get('format');
  const liabilityCode = url.searchParams.get('liabilityCode');

  let settlements = await listPayrollSettlements(period.id, companyId, { liabilityCode });
  settlements = settlements.map((settlement) => ({
    journalId: settlement.id,
    journalNumber: settlement.number,
    date: settlement.date,
    voucherRef: settlement.voucherRef,
    description: settlement.description,
    debit: settlement.debit,
    credit: settlement.credit,
    amount: settlement.amount,
    bankAccount: settlement.bankAccount,
    liabilityAccount: settlement.liabilityAccount,
    employeeId: settlement.employeeId,
    liabilityCode: settlement.liabilityCode,
    liabilityLabel: settlement.liabilityLabel,
    letterRef: settlement.letterRef || null,
    letterStatus: settlement.letterStatus || 'UNMATCHED',
  }));
  if (employeeFilter) {
    settlements = settlements.filter(s => s.employeeId === employeeFilter);
  }

  if (format === 'csv') {
    const headers = ['journalNumber','voucherRef','liabilityCode','liabilityLabel','date','debit','credit','bankAccount','liabilityAccount','employeeId','letterRef','letterStatus','description'];
    const rows = settlements.map(s => [
      s.journalNumber,
      s.voucherRef || '',
      s.liabilityCode || '',
      s.liabilityLabel || '',
      s.date ? new Date(s.date).toISOString().slice(0,10) : '',
      s.debit.toFixed(2),
      s.credit.toFixed(2),
      s.bankAccount || '',
      s.liabilityAccount || '',
      s.employeeId || '',
      s.letterRef || '',
      s.letterStatus || '',
      (s.description || '').replace(/"/g,'""')
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${String(v)}"`).join(',')),
    ].join('\n');
    return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="settlements_${period.ref}.csv"` } });
  }

  return NextResponse.json({ ok: true, period: { id: period.id, ref: period.ref }, count: settlements.length, settlements });
}
