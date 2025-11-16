import prisma from '@/lib/prisma';
import { generatePayslipsForPeriod } from '@/lib/payroll/engine';

export async function POST(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const period = await prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    if (period.status !== 'OPEN') return new Response(JSON.stringify({ error: 'period must be OPEN' }), { status: 400 });
    const result = await generatePayslipsForPeriod(id);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
