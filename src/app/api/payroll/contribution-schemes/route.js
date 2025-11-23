import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { validateContributionScheme, formatValidationError } from '@/lib/payrollValidation';

export async function GET() {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  const items = await prisma.contributionScheme.findMany({ orderBy: { code: 'asc' }, take: 200 });
  return Response.json({ ok: true, items });
}

export async function POST(req) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  try {
    const body = await req.json();
    const v = validateContributionScheme(body||{});
    if (!v.ok) return new Response(JSON.stringify(formatValidationError(v.errors)), { status: 400 });
    // Uniqueness guard
    const existing = await prisma.contributionScheme.findUnique({ where: { code: v.data.code } });
    if (existing) return new Response(JSON.stringify({ ok:false, error:'code.exists' }), { status:409 });
    const created = await prisma.contributionScheme.create({ data: v.data });
    return Response.json({ ok: true, item: created });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
