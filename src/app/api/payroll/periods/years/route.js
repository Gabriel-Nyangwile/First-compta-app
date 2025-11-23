import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';

export async function GET() {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const rows = await prisma.payrollPeriod.findMany({ select:{ year:true }, distinct:['year'], orderBy:{ year:'asc' } });
  const years = [...new Set(rows.map(r => r.year))].sort((a,b)=>a-b);
  return new Response(JSON.stringify({ ok:true, years }), { status:200, headers:{ 'Content-Type':'application/json' } });
}
