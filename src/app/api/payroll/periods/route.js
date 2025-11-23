import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';

export async function GET(req) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const where = status ? { status } : {};
  const periods = await prisma.payrollPeriod.findMany({ where, orderBy: [{ year:'desc' }, { month:'desc' }], take: 24 });
  return Response.json({ ok:true, periods: periods.map(p => ({ id:p.id, ref:p.ref, month:p.month, year:p.year, status:p.status })) });
}
