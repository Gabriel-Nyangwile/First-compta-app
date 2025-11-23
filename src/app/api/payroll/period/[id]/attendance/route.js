import prisma from '@/lib/prisma';

function toNumber(x) { return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const period = await prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    const rows = await prisma.employeeAttendance.findMany({
      where: { periodId: id },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { createdAt: 'asc' },
    });
    // Normalize decimals
    const data = rows.map(r => ({
      ...r,
      daysWorked: toNumber(r.daysWorked),
      workingDays: toNumber(r.workingDays),
      overtimeHours: toNumber(r.overtimeHours),
    }));
    return Response.json({ ok: true, rows: data });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const period = await prisma.payrollPeriod.findUnique({ where: { id } });
    if (!period) return new Response(JSON.stringify({ error: 'period not found' }), { status: 404 });
    if (period.status !== 'OPEN') return new Response(JSON.stringify({ error: `period must be OPEN (status=${period.status})` }), { status: 409 });
    const body = await req.json();
    const { employeeId, daysWorked, workingDays, overtimeHours, notes } = body || {};
    if (!employeeId) return new Response(JSON.stringify({ error: 'employeeId required' }), { status: 400 });
    const created = await prisma.employeeAttendance.upsert({
      where: { periodId_employeeId: { periodId: id, employeeId } },
      update: { daysWorked, workingDays, overtimeHours, notes },
      create: { periodId: id, employeeId, daysWorked, workingDays, overtimeHours, notes },
    });
    return Response.json({ ok: true, row: created });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, daysWorked, workingDays, overtimeHours, notes } = body || {};
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const att = await prisma.employeeAttendance.findUnique({ where: { id }, include: { period: true } });
    if (!att) return new Response(JSON.stringify({ error: 'attendance not found' }), { status: 404 });
    if (att.period?.status !== 'OPEN') return new Response(JSON.stringify({ error: `period must be OPEN (status=${att.period?.status})` }), { status: 409 });
    const updated = await prisma.employeeAttendance.update({ where: { id }, data: { daysWorked, workingDays, overtimeHours, notes } });
    return Response.json({ ok: true, row: updated });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });
    const att = await prisma.employeeAttendance.findUnique({ where: { id }, include: { period: true } });
    if (!att) return new Response(JSON.stringify({ error: 'attendance not found' }), { status: 404 });
    if (att.period?.status !== 'OPEN') return new Response(JSON.stringify({ error: `period must be OPEN (status=${att.period?.status})` }), { status: 409 });
    await prisma.employeeAttendance.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
