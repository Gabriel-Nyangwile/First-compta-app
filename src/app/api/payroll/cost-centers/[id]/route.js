import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { featureFlags } from '@/lib/features';
import { getRequestRole } from '@/lib/requestAuth';
import { validateCostCenter, formatValidationError } from '@/lib/payrollValidation';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(request, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  const companyId = requireCompanyId(request);
  const { id } = await params;
  const item = await prisma.costCenter.findUnique({ where: { id, companyId } });
  if (!item) return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
  return Response.json({ ok: true, item });
}

export async function PUT(req, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  const companyId = requireCompanyId(req);
  const role = await getRequestRole(req, { companyId });
  if (!checkPerm("managePayroll", role)) {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const current = await prisma.costCenter.findUnique({ where: { id, companyId } });
    if (!current) return new Response(JSON.stringify({ ok:false, error:'Not found'}), { status:404 });
    const merged = { ...current, ...body };
    const v = validateCostCenter(merged);
    if (!v.ok) return new Response(JSON.stringify(formatValidationError(v.errors)), { status:400 });
    if (v.data.code !== current.code) {
      const exists = await prisma.costCenter.findUnique({ where: { companyId_code: { companyId, code: v.data.code } } });
      if (exists) return new Response(JSON.stringify({ ok:false, error:'code.exists' }), { status:409 });
    }
    const updated = await prisma.costCenter.update({ where: { id, companyId }, data: v.data });
    return Response.json({ ok: true, item: updated });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  const companyId = requireCompanyId(request);
  const role = await getRequestRole(request, { companyId });
  if (!checkPerm("managePayroll", role)) {
    return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
  }
  const { id } = await params;
  try {
    // Safety: refuse deletion if referenced by transactions or allocations
    const txCount = await prisma.transaction.count({ where: { costCenterId: id, companyId } });
    const allocCount = await prisma.employeeCostAllocation.count({ where: { costCenterId: id, companyId } });
    if (txCount || allocCount) {
      return new Response(JSON.stringify({ ok: false, error: 'Cost center referenced; deactivate instead.' }), { status: 409 });
    }
    const deleted = await prisma.costCenter.delete({ where: { id, companyId } });
    return Response.json({ ok: true, item: deleted });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
