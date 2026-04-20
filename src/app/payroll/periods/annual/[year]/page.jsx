import React from 'react';
import AnnualCharts from '@/components/payroll/AnnualCharts';
import { formatAmount } from '@/lib/utils';

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
  const processingCurrency = data.currencyContext?.processingCurrency || 'XOF';
  const fiscalCurrency = data.currencyContext?.fiscalCurrency || 'CDF';
  const fmt = (value) => formatAmount(value, processingCurrency);
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
      <div className="text-sm text-gray-600">
        Devise de traitement: <span className="font-medium">{processingCurrency}</span> · Devise fiscale: <span className="font-medium">{fiscalCurrency}</span>
      </div>
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
              <td className="p-2 border text-right">{fmt(m.grossTotal)}</td>
              <td className="p-2 border text-right text-orange-700">{fmt(m.grossNegative)}</td>
              <td className="p-2 border text-right">{fmt(m.netTotal)}</td>
              <td className="p-2 border text-right text-orange-700">{fmt(m.netNegative)}</td>
              <td className="p-2 border text-right">{(m.correctionRatioGross*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{(m.correctionRatioNet*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{fmt(m.cnssEmployeeTotal)}</td>
              <td className="p-2 border text-right">{fmt(m.iprTaxTotal)}</td>
              <td className="p-2 border text-right">{fmt(m.cnssEmployerTotal)}</td>
              <td className="p-2 border text-right">{fmt(m.onemTotal)}</td>
              <td className="p-2 border text-right">{fmt(m.inppTotal)}</td>
              <td className="p-2 border text-right">{fmt(m.employerChargesTotal)}</td>
              <td className="p-2 border text-right">{fmt(m.overtimeTotal)}</td>
              <td className="p-2 border text-right font-semibold">{fmt(m.ytdGross)}</td>
              <td className="p-2 border text-right font-semibold">{fmt(m.ytdNet)}</td>
              <td className="p-2 border text-right text-orange-700">{fmt(m.ytdCorrectionsGross)}</td>
              <td className="p-2 border text-right text-orange-700">{fmt(m.ytdCorrectionsNet)}</td>
              <td className="p-2 border text-right">{(m.ytdCorrectionRatioGross*100).toFixed(1)}%</td>
              <td className="p-2 border text-right">{(m.ytdCorrectionRatioNet*100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
