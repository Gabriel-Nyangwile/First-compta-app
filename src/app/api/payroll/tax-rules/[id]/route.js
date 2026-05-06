import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { featureFlags } from '@/lib/features';
import { getRequestRole } from '@/lib/requestAuth';
import { validateTaxRule, formatValidationError } from '@/lib/payrollValidation';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(request, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  const companyId = requireCompanyId(request);
  const { id } = await params;
  const item = await prisma.taxRule.findUnique({ where: { id, companyId } });
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
    const current = await prisma.taxRule.findUnique({ where: { id, companyId } });
    if (!current) return new Response(JSON.stringify({ ok:false, error:'Not found'}), { status:404 });
    const merged = { ...current, ...body };
    const v = validateTaxRule(merged);
    if (!v.ok) return new Response(JSON.stringify(formatValidationError(v.errors)), { status:400 });
    if (v.data.code !== current.code) {
      const exists = await prisma.taxRule.findUnique({ where: { companyId_code: { companyId, code: v.data.code } } });
      if (exists) return new Response(JSON.stringify({ ok:false, error:'code.exists' }), { status:409 });
    }
    const updated = await prisma.taxRule.update({ where: { id, companyId }, data: v.data });
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
    const deleted = await prisma.taxRule.delete({ where: { id, companyId } });
    return Response.json({ ok: true, item: deleted });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
