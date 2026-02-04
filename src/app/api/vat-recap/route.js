import { NextResponse } from 'next/server';
import { computeVatRecap } from '@/lib/vatRecap';
import { formatAmountPlain, formatRatePercent } from '@/lib/utils';
import { requireCompanyId } from '@/lib/tenant';

function toCSV(data) {
  const header = ['period','direction','rate','ratePercent','base','vat'];
  const lines = [header.join(',')];
  for (const r of data.rows) {
  lines.push([r.period,r.direction,r.rate.toFixed(2),formatRatePercent(r.ratePercent),formatAmountPlain(r.base),formatAmountPlain(r.vat)].join(','));
  }
  // Totals line
  lines.push('TOTALS,,,,,' );
  lines.push(`# collectedBase=${formatAmountPlain(data.totals.collectedBase)} collectedVat=${formatAmountPlain(data.totals.collectedVat)} deductibleBase=${formatAmountPlain(data.totals.deductibleBase)} deductibleVat=${formatAmountPlain(data.totals.deductibleVat)} balanceVat=${formatAmountPlain(data.totals.balanceVat)}`);
  return lines.join('\n');
}

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const granularity = searchParams.get('granularity') || 'month';
    const includeZero = searchParams.get('includeZero') === 'true';
    const format = searchParams.get('format') || 'json';

    const recap = await computeVatRecap({
      companyId,
      from,
      to,
      granularity,
      includeZero,
    });

    if (format === 'csv') {
      const csv = toCSV(recap);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vat-recap-${Date.now()}.csv"`
        }
      });
    }

    return NextResponse.json(recap);
  } catch (e) {
    console.error('VAT recap error', e);
    return NextResponse.json({ error: e.message || 'Erreur récap TVA' }, { status: 500 });
  }
}
