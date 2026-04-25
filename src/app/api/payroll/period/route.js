import prisma from '@/lib/prisma';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { nextSequence } from '@/lib/sequence';
import { requireCompanyId } from '@/lib/tenant';

export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const body = await request.json();
    const month = Number(body?.month);
    const year = Number(body?.year);
    if (!month || !year) return new Response(JSON.stringify({ error: 'month and year required' }), { status: 400 });
    const ref = await nextSequence(prisma, 'PAYROLL_PERIOD', 'PP-', companyId);
    const currencyContext = await getPayrollCurrencyContext(companyId);
    const currencySnapshot = {
      processingCurrency: currencyContext.processingCurrency,
      fiscalCurrency: currencyContext.fiscalCurrency,
      fxRate: currencyContext.processingCurrency === currencyContext.fiscalCurrency ? 1 : null,
    };
    const period = await prisma.payrollPeriod.create({
      data: { companyId, ref, month, year, status: 'OPEN', ...currencySnapshot },
    });
    return Response.json({ ok: true, period });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
