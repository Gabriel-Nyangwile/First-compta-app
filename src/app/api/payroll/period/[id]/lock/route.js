import prisma from '@/lib/prisma';
import { postPayrollPeriodTx } from '@/lib/payroll/postings';

export async function POST(_req, { params }) {
  try {
    const id = params?.id;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    // Wrap in transaction: lock then post
    const result = await prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.findUnique({ where: { id } });
      if (!period) throw new Error('period not found');
      if (period.status !== 'OPEN') throw new Error('period must be OPEN to lock');
      await tx.payrollPeriod.update({ where: { id }, data: { status: 'LOCKED', lockedAt: new Date() } });
      // Create postings & journal -> updates status to POSTED
  const posting = await postPayrollPeriodTx(tx, id);
      // Reload period
      const finalPeriod = await tx.payrollPeriod.findUnique({ where: { id } });
      return { period: finalPeriod, journal: posting.journal, transactions: posting.transactions };
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
