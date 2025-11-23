import { featureFlags } from '@/lib/features';
import { sanitizePlain } from '@/lib/sanitizePlain';
import { aggregatePeriodSummary } from '@/lib/payroll/aggregatePeriod';

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const { id } = await params;
  if (!id) return new Response(JSON.stringify({ ok:false, error:'Missing period id'}), { status:400 });
  const summaryRaw = await aggregatePeriodSummary(id);
  if (!summaryRaw) return new Response(JSON.stringify({ ok:false, error:'Period not found'}), { status:404 });
  const summary = sanitizePlain(summaryRaw);
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  if (format === 'csv') {
    const headers = ['ref','employeeName','gross','net','cnssEmployee','iprTax','cnssEmployer','onem','inpp','overtime','employerCharges','linesCount'];
    const rows = summary.employees.map(e => [e.ref,e.employeeName,e.gross.toFixed(2),e.net.toFixed(2),e.cnssEmployee.toFixed(2),e.iprTax.toFixed(2),e.cnssEmployer.toFixed(2),e.onem.toFixed(2),e.inpp.toFixed(2),e.overtime.toFixed(2),(e.employerCharges).toFixed(2),e.linesCount]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
    return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="period_summary_${summary.period.ref}.csv"` } });
  }
  return new Response(JSON.stringify({ ok:true, ...summary }), { status:200, headers:{ 'Content-Type':'application/json' } });
}
