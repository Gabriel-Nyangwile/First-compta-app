import { featureFlags } from '@/lib/features';
import { aggregateAnnualPayroll } from '@/lib/payroll/aggregateAnnual';

export async function GET(req) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return new Response(JSON.stringify({ ok:false, error:'Invalid year'}), { status:400 });
  const data = await aggregateAnnualPayroll(year);
  const format = url.searchParams.get('format');
  if (format === 'csv') {
    const headers = ['month','periodRef','grossTotal','netTotal','grossNegative','netNegative','correctionRatioGross','correctionRatioNet','cnssEmployeeTotal','iprTaxTotal','cnssEmployerTotal','onemTotal','inppTotal','employerChargesTotal','overtimeTotal','ytdGross','ytdNet','ytdCorrectionsGross','ytdCorrectionsNet','ytdCorrectionRatioGross','ytdCorrectionRatioNet'];
    const rows = data.months.map(r => headers.map(h => r[h] == null ? '' : r[h]));
    const csv = [headers.join(','), ...rows.map(row => row.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')].join('\n');
    return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="annual_payroll_${year}.csv"` } });
  }
  return new Response(JSON.stringify({ ok:true, year, months: data.months }), { status:200, headers:{ 'Content-Type':'application/json' } });
}
