import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { featureFlags } from '@/lib/features';
import { getRequestRole } from '@/lib/requestAuth';
import { validateCostCenter, formatValidationError } from '@/lib/payrollValidation';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(request) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  const companyId = requireCompanyId(request);
  const items = await prisma.costCenter.findMany({ where: { companyId }, orderBy: { code: 'asc' }, take: 200 });
  return Response.json({ ok: true, items });
}

export async function POST(req) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  try {
    const companyId = requireCompanyId(req);
    const role = await getRequestRole(req, { companyId });
    if (!checkPerm("managePayroll", role)) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), { status: 403 });
    }
    const body = await req.json();
    const v = validateCostCenter(body||{});
    if (!v.ok) return new Response(JSON.stringify(formatValidationError(v.errors)), { status:400 });
    const existing = await prisma.costCenter.findUnique({ where: { companyId_code: { companyId, code: v.data.code } } });
    if (existing) return new Response(JSON.stringify({ ok:false, error:'code.exists' }), { status:409 });
    const created = await prisma.costCenter.create({ data: { ...v.data, companyId } });
    return Response.json({ ok: true, item: created });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
