import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { sanitizeArray } from '@/lib/sanitizePlain';

// Aggregate payroll configuration endpoint
// Returns contributionSchemes, taxRules, costCenters in one payload.
// Keep minimal read-only scope; POST/PUT handled by individual resources.
export async function GET() {
  if (!featureFlags.payroll) {
    return new Response(JSON.stringify({ ok: false, error: 'Payroll disabled' }), { status: 403 });
  }
  try {
    const [contributionSchemes, taxRules, costCenters] = await Promise.all([
      prisma.contributionScheme.findMany({ orderBy: { code: 'asc' }, take: 200 }),
      prisma.taxRule.findMany({ orderBy: { code: 'asc' }, take: 200 }),
      prisma.costCenter.findMany({ orderBy: { code: 'asc' }, take: 200 })
    ]);
    return Response.json({
      ok: true,
      contributionSchemes: sanitizeArray(contributionSchemes),
      taxRules: sanitizeArray(taxRules),
      costCenters: sanitizeArray(costCenters)
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
