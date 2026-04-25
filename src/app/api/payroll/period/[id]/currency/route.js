import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function PUT(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

    const period = await prisma.payrollPeriod.findUnique({ where: { id, companyId } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    if (period.status !== 'OPEN') {
      return new Response(JSON.stringify({ error: `period must be OPEN (status=${period.status})` }), { status: 409 });
    }

    const body = await req.json();
    const fxRate = toNumber(body?.fxRate);
    if (!fxRate || fxRate <= 0) {
      return new Response(JSON.stringify({ error: 'fxRate must be a positive number' }), { status: 400 });
    }

    const updated = await prisma.payrollPeriod.update({
      where: { id, companyId },
      data: { fxRate },
      select: {
        id: true,
        ref: true,
        processingCurrency: true,
        fiscalCurrency: true,
        fxRate: true,
      },
    });

    return Response.json({
      ok: true,
      period: {
        ...updated,
        fxRate: updated.fxRate?.toNumber?.() ?? updated.fxRate ?? null,
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
