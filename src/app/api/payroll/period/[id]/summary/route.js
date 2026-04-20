import { featureFlags } from '@/lib/features';
import { sanitizePlain } from '@/lib/sanitizePlain';
import { getPayrollCurrencyContext } from '@/lib/payroll/context';
import { aggregatePeriodSummary } from '@/lib/payroll/aggregatePeriod';
import { requireCompanyId } from '@/lib/tenant';

export async function GET(req, { params }) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const companyId = requireCompanyId(req);
  const currencyContext = await getPayrollCurrencyContext(companyId);
  const { id } = await params;
  if (!id) return new Response(JSON.stringify({ ok:false, error:'Missing period id'}), { status:400 });
  const summaryRaw = await aggregatePeriodSummary(id, companyId);
  if (!summaryRaw) return new Response(JSON.stringify({ ok:false, error:'Period not found'}), { status:404 });
  const summary = sanitizePlain(summaryRaw);
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const section = searchParams.get('section');
  if (format === 'csv') {
    if (section === 'liabilities') {
      const headers = ['code','label','group','total','settled','remaining','settlementStatus','paymentFlowReady'];
      const rows = summary.liabilities.map((item) => [
        item.code,
        item.label,
        item.group,
        item.total.toFixed(2),
        item.settled.toFixed(2),
        item.remaining.toFixed(2),
        item.settlementStatus,
        item.paymentFlowReady ? 'yes' : 'no',
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
      return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="period_liabilities_${summary.period.ref}.csv"` } });
    }
    const headers = ['ref','employeeNumber','employeeName','gross','net','settledAmount','remainingAmount','isSettled','cnssEmployee','iprTax','cnssEmployer','onem','inpp','overtime','employerCharges','linesCount'];
    const rows = summary.employees.map(e => [e.ref,e.employeeNumber || '',e.employeeName,e.gross.toFixed(2),e.net.toFixed(2),e.settledAmount.toFixed(2),e.remainingAmount.toFixed(2),e.isSettled ? 'yes' : 'no',e.cnssEmployee.toFixed(2),e.iprTax.toFixed(2),e.cnssEmployer.toFixed(2),e.onem.toFixed(2),e.inpp.toFixed(2),e.overtime.toFixed(2),(e.employerCharges).toFixed(2),e.linesCount]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
    return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="period_summary_${summary.period.ref}.csv"` } });
  }
  return new Response(JSON.stringify({ ok:true, currencyContext, ...summary }), { status:200, headers:{ 'Content-Type':'application/json' } });
}
