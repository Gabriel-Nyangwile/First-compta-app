import prisma from '@/lib/prisma';
import { generatePayslipsForPeriod } from '@/lib/payroll/engine';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const period = await prisma.payrollPeriod.findUnique({ where: { id, companyId } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    if (period.status !== 'OPEN') return new Response(JSON.stringify({ error: 'period must be OPEN' }), { status: 400 });
    const fxRate = period.fxRate?.toNumber?.() ?? Number(period.fxRate ?? 0);
    if (period.processingCurrency !== period.fiscalCurrency && (!fxRate || fxRate <= 0)) {
      return new Response(JSON.stringify({ error: `Taux de change requis pour convertir ${period.processingCurrency} vers ${period.fiscalCurrency}` }), { status: 400 });
    }
    const result = await generatePayslipsForPeriod(id, companyId);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
