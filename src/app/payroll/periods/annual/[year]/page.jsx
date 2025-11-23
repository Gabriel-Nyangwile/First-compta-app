import React from 'react';
import AnnualCharts from '@/components/payroll/AnnualCharts';

async function fetchAnnual(year){
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/payroll/periods/annual-summary?year=${year}`, { cache:'no-store' });
  if(!res.ok) return { ok:false, error:'Fetch failed'};
  return res.json();
}
async function fetchYears(){
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/payroll/periods/years`, { cache:'no-store' });
  if(!res.ok) return { ok:false, years:[] };
  return res.json();
}

export default async function AnnualPayrollPage({ params, searchParams }){
  const year = Number(params.year);
  const [{ ok:okYears, years }, data] = await Promise.all([fetchYears(), fetchAnnual(year)]);
  if(!data.ok) return <div className="p-4">Annual payroll unavailable: {data.error}</div>;
  const months = data.months;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold flex items-center gap-4">Récapitulatif Annuel Paie {year}
        {okYears && years?.length > 0 && (
          <form action="" method="get" onChange={(e)=>{}}>
            <label className="text-sm mr-2" htmlFor="yearSel">Année:</label>
            <select id="yearSel" name="year" defaultValue={year} className="border px-2 py-1 text-sm" onChange={(e)=>{ if(e.target.value) window.location.href = `/payroll/periods/annual/${e.target.value}`; }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </form>
        )}
      </h1>
      <div className="flex gap-4 flex-wrap items-center text-sm">
        <a className="text-blue-600 underline" href={`/api/payroll/periods/annual-summary?year=${year}&format=csv`}>Exporter CSV</a>
        <a className="text-blue-600 underline" href={`/api/payroll/periods/annual-summary/pdf?year=${year}`}>Exporter PDF</a>
        <a className="text-blue-600 underline" href={`/api/payroll/periods/annual-summary/xlsx?year=${year}`}>Exporter XLSX</a>
      </div>
      <AnnualCharts months={months} />
      <table className="min-w-full text-xs border mt-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Mois</th>
            <th className="p-2 border">Brut</th>
            <th className="p-2 border">Corr Brut</th>
            <th className="p-2 border">Net</th>
            <th className="p-2 border">Corr Net</th>
            <th className="p-2 border" title="% Corrections Brut = Corrections Brut / Brut absolu">Corr% Brut</th>
            <th className="p-2 border" title="% Corrections Net = Corrections Net / Net absolu">Corr% Net</th>
            <th className="p-2 border">CNSS Sal.</th>
            <th className="p-2 border">IPR Taxe</th>
            <th className="p-2 border">CNSS Employeur</th>
            <th className="p-2 border">ONEM</th>
            <th className="p-2 border">INPP</th>
            <th className="p-2 border">Charges Employeur</th>
            <th className="p-2 border">Heures Sup.</th>
            <th className="p-2 border">Cumul Brut</th>
            <th className="p-2 border">Cumul Net</th>
            <th className="p-2 border">YTD Corr Brut</th>
            <th className="p-2 border">YTD Corr Net</th>
            <th className="p-2 border" title="% YTD Corrections Brut = YTD Corrections Brut / YTD Brut">YTD Corr% Brut</th>
            <th className="p-2 border" title="% YTD Corrections Net = YTD Corrections Net / YTD Net">YTD Corr% Net</th>
          </tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m.month} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border">{m.month}</td>
              <td className="p-2 border text-right">{m.grossTotal.toFixed(2)}</td>
              <td className="p-2 border text-right text-orange-700">{m.grossNegative.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.netTotal.toFixed(2)}</td>
              <td className="p-2 border text-right text-orange-700">{m.netNegative.toFixed(2)}</td>
              <td className="p-2 border text-right">{(m.correctionRatioGross*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{(m.correctionRatioNet*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{m.cnssEmployeeTotal.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.iprTaxTotal.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.cnssEmployerTotal.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.onemTotal.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.inppTotal.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.employerChargesTotal.toFixed(2)}</td>
              <td className="p-2 border text-right">{m.overtimeTotal.toFixed(2)}</td>
              <td className="p-2 border text-right font-semibold">{m.ytdGross.toFixed(2)}</td>
              <td className="p-2 border text-right font-semibold">{m.ytdNet.toFixed(2)}</td>
              <td className="p-2 border text-right text-orange-700">{m.ytdCorrectionsGross.toFixed(2)}</td>
              <td className="p-2 border text-right text-orange-700">{m.ytdCorrectionsNet.toFixed(2)}</td>
              <td className="p-2 border text-right">{(m.ytdCorrectionRatioGross*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{(m.ytdCorrectionRatioNet*100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
