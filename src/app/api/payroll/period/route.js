import prisma from '@/lib/prisma';
import { nextSequence } from '@/lib/sequence';

export async function POST(request) {
  try {
    const body = await request.json();
    const month = Number(body?.month);
    const year = Number(body?.year);
    if (!month || !year) return new Response(JSON.stringify({ error: 'month and year required' }), { status: 400 });
    const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-');
    const period = await prisma.payrollPeriod.create({ data: { ref, month, year, status: 'OPEN' } });
    return Response.json({ ok: true, period });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
