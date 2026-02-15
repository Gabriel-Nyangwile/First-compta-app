import { NextResponse } from 'next/server';
import { featureFlags } from '@/lib/features';
import { auditPayrollPeriod } from '@/lib/payroll/audit';
import { requireCompanyId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return NextResponse.json({ error: 'Payroll disabled' }, { status: 403 });
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const result = await auditPayrollPeriod(id, undefined, companyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Audit failed' }, { status: 500 });
  }
}
