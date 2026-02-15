import prisma from '@/lib/prisma';
import { requireCompanyId } from '@/lib/tenant';

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

export async function GET(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const period = await prisma.payrollPeriod.findUnique({ where: { id, companyId } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    const rows = await prisma.payrollVariable.findMany({
      where: { periodId: id, companyId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } }, costCenter: { select: { id: true, code: true, label: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const data = rows.map(r => ({ ...r, amount: toNumber(r.amount) }));
    return Response.json({ ok: true, rows: data });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = await params;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const period = await prisma.payrollPeriod.findUnique({ where: { id, companyId } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    if (period.status !== 'OPEN') return new Response(JSON.stringify({ error: `period must be OPEN (status=${period.status})` }), { status: 409 });
    const body = await req.json();
    const { employeeId, kind, label, amount, costCenterId } = body || {};
    if (!employeeId || !kind || typeof amount === 'undefined') {
      return new Response(JSON.stringify({ error: 'employeeId, kind and amount required' }), { status: 400 });
    }
    const created = await prisma.payrollVariable.create({
      data: { companyId, periodId: id, employeeId, kind, label: label ?? kind, amount, costCenterId: costCenterId ?? null },
    });
    return Response.json({ ok: true, row: created });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const { id, kind, label, amount, costCenterId } = body || {};
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const row = await prisma.payrollVariable.findUnique({ where: { id, companyId }, include: { period: true } });
    if (!row) return new Response(JSON.stringify({ error: 'variable not found' }), { status: 404 });
    if (row.period?.status !== 'OPEN') return new Response(JSON.stringify({ error: `period must be OPEN (status=${row.period?.status})` }), { status: 409 });
    const updated = await prisma.payrollVariable.update({
      where: { id, companyId },
      data: { kind, label, amount, costCenterId: costCenterId ?? null },
    });
    return Response.json({ ok: true, row: updated });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const row = await prisma.payrollVariable.findUnique({ where: { id, companyId }, include: { period: true } });
    if (!row) return new Response(JSON.stringify({ error: 'variable not found' }), { status: 404 });
    if (row.period?.status !== 'OPEN') return new Response(JSON.stringify({ error: `period must be OPEN (status=${row.period?.status})` }), { status: 409 });
    await prisma.payrollVariable.delete({ where: { id, companyId } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
