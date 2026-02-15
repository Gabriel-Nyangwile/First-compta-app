import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const companyId = requireCompanyId(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const where = status ? { companyId, status } : { companyId };
  const periods = await prisma.payrollPeriod.findMany({ where, orderBy: [{ year:'desc' }, { month:'desc' }], take: 24 });
  return Response.json({ ok:true, periods: periods.map(p => ({ id:p.id, ref:p.ref, month:p.month, year:p.year, status:p.status })) });
}
