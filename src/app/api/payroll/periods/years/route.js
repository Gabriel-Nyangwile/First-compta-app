import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(request) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const companyId = requireCompanyId(request);
  const rows = await prisma.payrollPeriod.findMany({ where: { companyId }, select:{ year:true }, distinct:['year'], orderBy:{ year:'asc' } });
  const years = [...new Set(rows.map(r => r.year))].sort((a,b)=>a-b);
  return new Response(JSON.stringify({ ok:true, years }), { status:200, headers:{ 'Content-Type':'application/json' } });
}
