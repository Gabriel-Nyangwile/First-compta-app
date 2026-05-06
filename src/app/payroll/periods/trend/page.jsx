import TrendCharts from '@/components/payroll/TrendCharts';
import { internalApiFetch } from '@/lib/url';
import { formatAmount } from '@/lib/utils';

async function fetchTrend(from, to){
  const res = await internalApiFetch(`/api/payroll/periods/trend?from=${from}&to=${to}`, { cache:'no-store' });
  if(!res.ok) return { ok:false, error:'Fetch failed'};
  return res.json();
}
async function fetchYears(){
  const res = await internalApiFetch('/api/payroll/periods/years', { cache:'no-store' });
  if(!res.ok) return { ok:false, years:[] };
  return res.json();
}

export default async function TrendPage({ searchParams }) {
  const sp = await searchParams;
  const yearsRes = await fetchYears();
  const years = yearsRes.years || [];
  const defaultFrom = years[0] || new Date().getFullYear();
  const defaultTo = years[years.length-1] || defaultFrom;
  const from = Number(sp?.from) || defaultFrom;
  const to = Number(sp?.to) || defaultTo;
  const trend = await fetchTrend(from, to);
  if(!trend.ok) return <div className="p-6">Trend data unavailable: {trend.error}</div>;
  const processingCurrency = trend.currencyContext?.processingCurrency || 'XOF';
  const fiscalCurrency = trend.currencyContext?.fiscalCurrency || 'CDF';
  const fmt = (value) => formatAmount(value, processingCurrency);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Tendance Pluriannuelle Paie ({trend.from} → {trend.to})</h1>
      <div className="text-sm text-gray-600">
        Devise de traitement: <span className="font-medium">{processingCurrency}</span> · Devise fiscale: <span className="font-medium">{fiscalCurrency}</span>
      </div>
      {(trend.currencyContext?.mixedProcessingCurrencies || trend.currencyContext?.missingFxPeriods?.length > 0) && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {trend.currencyContext?.mixedProcessingCurrencies && (
            <div>Attention: la plage contient plusieurs devises de traitement ({trend.currencyContext.processingCurrencies?.join(', ')}). Les comparaisons pluriannuelles doivent être interprétées avec prudence.</div>
          )}
          {trend.currencyContext?.missingFxPeriods?.length > 0 && (
            <div>Taux fiscal manquant sur: {trend.currencyContext.missingFxPeriods.map(p => `${p.year}-${p.month}/${p.periodRef}`).join(', ')}.</div>
          )}
        </div>
      )}
      <form className="flex gap-4 items-end text-sm" action="" method="get">
        <label className="flex flex-col">De
          <select name="from" defaultValue={from} className="border px-2 py-1 mt-1">{years.map(y => <option key={y}>{y}</option>)}</select>
        </label>
        <label className="flex flex-col">À
          <select name="to" defaultValue={to} className="border px-2 py-1 mt-1">{years.map(y => <option key={y}>{y}</option>)}</select>
        </label>
        <button type="submit" className="bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-600">Actualiser</button>
      </form>
      <TrendCharts years={trend.years} currency={processingCurrency} />
      <table className="min-w-full text-xs border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Année</th>
            <th className="p-2 border">Devises</th>
            <th className="p-2 border">Brut</th>
            <th className="p-2 border">Net</th>
            <th className="p-2 border">Corr Brut</th>
            <th className="p-2 border">Corr Net</th>
            <th className="p-2 border" title="% Corrections Brut = Corrections Brut / Brut absolu">Corr% Brut</th>
            <th className="p-2 border" title="% Corrections Net = Corrections Net / Net absolu">Corr% Net</th>
            <th className="p-2 border">CNSS Sal</th>
            <th className="p-2 border">CNSS Emp</th>
            <th className="p-2 border">IPR</th>
            <th className="p-2 border">ONEM</th>
            <th className="p-2 border">INPP</th>
            <th className="p-2 border">Charges Employeur</th>
            <th className="p-2 border">HS</th>
          </tr>
        </thead>
        <tbody>
          {trend.years.map(y => (
            <tr key={y.year} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border">{y.year}</td>
              <td className="p-2 border">{y.currencySummary?.processingCurrencies?.join(', ') || '-'}</td>
              <td className="p-2 border text-right">{fmt(y.totals.gross)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.net)}</td>
              <td className="p-2 border text-right text-orange-700">{fmt(y.totals.corrGross)}</td>
              <td className="p-2 border text-right text-orange-700">{fmt(y.totals.corrNet)}</td>
              <td className="p-2 border text-right">{(y.totals.corrRatioGross*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{(y.totals.corrRatioNet*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{fmt(y.totals.cnssSal)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.cnssEmp)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.ipr)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.onem)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.inpp)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.charges)}</td>
              <td className="p-2 border text-right">{fmt(y.totals.ot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
