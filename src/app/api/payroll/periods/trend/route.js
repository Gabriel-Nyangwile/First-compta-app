import prisma from '@/lib/prisma';
import { featureFlags } from '@/lib/features';
import { aggregateAnnualPayroll } from '@/lib/payroll/aggregateAnnual';

export async function GET(req) {
  if (!featureFlags.payroll) return new Response(JSON.stringify({ ok:false, error:'Payroll disabled'}), { status:403 });
  const url = new URL(req.url);
  const from = Number(url.searchParams.get('from')) || new Date().getFullYear();
  const to = Number(url.searchParams.get('to')) || from;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from>to) return new Response(JSON.stringify({ ok:false, error:'Invalid range'}), { status:400 });
  // Clamp range
  const minYear = 2000, maxYear = 2100;
  const start = Math.max(minYear, Math.min(maxYear, from));
  const end = Math.max(start, Math.min(maxYear, to));
  const years = [];
  for (let y=start; y<=end; y++) {
    const annual = await aggregateAnnualPayroll(y);
    const totals = annual.months.reduce((acc,m)=>{ acc.gross+=m.grossTotal; acc.net+=m.netTotal; acc.cnssSal+=m.cnssEmployeeTotal; acc.ipr+=m.iprTaxTotal; acc.cnssEmp+=m.cnssEmployerTotal; acc.onem+=m.onemTotal; acc.inpp+=m.inppTotal; acc.charges+=m.employerChargesTotal; acc.ot+=m.overtimeTotal; acc.corrGross+=m.grossNegative; acc.corrNet+=m.netNegative; return acc; }, { gross:0, net:0, cnssSal:0, ipr:0, cnssEmp:0, onem:0, inpp:0, charges:0, ot:0, corrGross:0, corrNet:0 });
    totals.corrRatioGross = totals.gross!==0 ? (totals.corrGross / Math.abs(totals.gross)) : 0;
    totals.corrRatioNet = totals.net!==0 ? (totals.corrNet / Math.abs(totals.net)) : 0;
    years.push({ year:y, totals });
  }
  if (url.searchParams.get('format') === 'csv') {
    const headers = ['year','gross','net','corrGross','corrNet','corrRatioGross','corrRatioNet','cnssSal','cnssEmp','ipr','onem','inpp','charges','ot'];
    const rows = years.map(y => headers.map(h => y.totals[h] ?? y[h] ?? ''));
    const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')].join('\n');
    return new Response(csv, { status:200, headers:{ 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="payroll_trend_${start}_${end}.csv"` } });
  }
  return new Response(JSON.stringify({ ok:true, from:start, to:end, years }), { status:200, headers:{ 'Content-Type':'application/json' } });
}
