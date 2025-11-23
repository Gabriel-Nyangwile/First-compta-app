import TrendCharts from '@/components/payroll/TrendCharts';

async function fetchTrend(from, to){
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/payroll/periods/trend?from=${from}&to=${to}`, { cache:'no-store' });
  if(!res.ok) return { ok:false, error:'Fetch failed'};
  return res.json();
}
async function fetchYears(){
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/payroll/periods/years`, { cache:'no-store' });
  if(!res.ok) return { ok:false, years:[] };
  return res.json();
}

export default async function TrendPage({ searchParams }) {
  const yearsRes = await fetchYears();
  const years = yearsRes.years || [];
  const defaultFrom = years[0] || new Date().getFullYear();
  const defaultTo = years[years.length-1] || defaultFrom;
  const from = Number(searchParams.from) || defaultFrom;
  const to = Number(searchParams.to) || defaultTo;
  const trend = await fetchTrend(from, to);
  if(!trend.ok) return <div className="p-6">Trend data unavailable: {trend.error}</div>;
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Tendance Pluriannuelle Paie ({trend.from} → {trend.to})</h1>
      <form className="flex gap-4 items-end text-sm" action="" method="get">
        <label className="flex flex-col">De
          <select name="from" defaultValue={from} className="border px-2 py-1 mt-1">{years.map(y => <option key={y}>{y}</option>)}</select>
        </label>
        <label className="flex flex-col">À
          <select name="to" defaultValue={to} className="border px-2 py-1 mt-1">{years.map(y => <option key={y}>{y}</option>)}</select>
        </label>
        <button type="submit" className="bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-600">Actualiser</button>
      </form>
      <TrendCharts years={trend.years} />
      <table className="min-w-full text-xs border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Année</th>
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
              <td className="p-2 border text-right">{y.totals.gross.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.net.toFixed(2)}</td>
              <td className="p-2 border text-right text-orange-700">{y.totals.corrGross.toFixed(2)}</td>
              <td className="p-2 border text-right text-orange-700">{y.totals.corrNet.toFixed(2)}</td>
              <td className="p-2 border text-right">{(y.totals.corrRatioGross*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{(y.totals.corrRatioNet*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{y.totals.cnssSal.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.cnssEmp.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.ipr.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.onem.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.inpp.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.charges.toFixed(2)}</td>
              <td className="p-2 border text-right">{y.totals.ot.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
