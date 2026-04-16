import { NextResponse } from 'next/server';
import { featureFlags } from '@/lib/features';
import { requireCompanyId } from '@/lib/tenant';
import { getPayrollLetteringSummary, matchPayrollLiabilityTransactions } from '@/lib/payroll/lettering';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing period id' }, { status: 400 });
  try {
    const payload = await getPayrollLetteringSummary({ periodId: id, companyId });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Payroll lettering summary failed' }, { status: 400 });
  }
}

export async function POST(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing period id' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const liabilityCode = body?.liabilityCode || null;
  try {
    if (liabilityCode) {
      const result = await matchPayrollLiabilityTransactions({ periodId: id, liabilityCode, companyId });
      const summary = await getPayrollLetteringSummary({ periodId: id, companyId });
      return NextResponse.json({ ok: true, result, ...summary });
    }
    const results = [];
    for (const code of ['NET_PAY', 'CNSS', 'ONEM', 'INPP', 'PAYE_TAX']) {
      results.push(await matchPayrollLiabilityTransactions({ periodId: id, liabilityCode: code, companyId }));
    }
    const summary = await getPayrollLetteringSummary({ periodId: id, companyId });
    return NextResponse.json({ ok: true, results, ...summary });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Payroll lettering failed' }, { status: 400 });
  }
}