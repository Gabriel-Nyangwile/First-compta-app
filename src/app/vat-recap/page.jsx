import React from 'react';
import { computeVatRecap } from '@/lib/vatRecap';
import Amount from '@/components/Amount.jsx';
import { formatRatePercent } from '@/lib/utils';

export default async function VatRecapPage(props) {
  // Harmonisation avec autres pages: searchParams peut être Promise-like selon streaming
  const sp = await props.searchParams;
  const from = sp?.from ?? '';
  const to = sp?.to ?? '';
  const granularity = sp?.granularity ?? 'month';
  const includeZero = sp?.includeZero ?? 'false';
  const recap = await computeVatRecap({ from: from || undefined, to: to || undefined, granularity, includeZero: includeZero === 'true' });
  return (
    <main className="px-6 max-w-[1100px] mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2">Récapitulatif TVA</h1>
      <p className="text-gray-600 mb-6">Aperçu consolidé des bases et montants de TVA collectée et déductible.</p>
      <form className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8" action="/vat-recap" method="get">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
          <input type="date" name="from" defaultValue={from||''} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">À</label>
          <input type="date" name="to" defaultValue={to||''} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Granularité</label>
          <select name="granularity" defaultValue={granularity} className="w-full border rounded px-2 py-1">
            <option value="month">Mois</option>
            <option value="all">Global</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Inclure zéros</label>
          <select name="includeZero" defaultValue={includeZero} className="w-full border rounded px-2 py-1">
            <option value="false">Non</option>
            <option value="true">Oui</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded w-full">Filtrer</button>
        </div>
      </form>

      <div className="flex gap-4 mb-6">
        <a className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded border" href={`/api/vat-recap?from=${from||''}&to=${to||''}&granularity=${granularity}&includeZero=${includeZero}&format=csv`} target="_blank">Télécharger CSV</a>
        <a className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded border" href={`/api/vat-recap/pdf?from=${from||''}&to=${to||''}&granularity=${granularity}&includeZero=${includeZero}`} target="_blank">Ouvrir PDF</a>
      </div>

      <div className="overflow-auto border rounded shadow-sm bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Période</th>
              <th className="px-3 py-2 text-left font-medium">Sens</th>
              <th className="px-3 py-2 text-right font-medium">Taux %</th>
              <th className="px-3 py-2 text-right font-medium">Base €</th>
              <th className="px-3 py-2 text-right font-medium">TVA €</th>
            </tr>
          </thead>
          <tbody>
            {recap.rows.map(r => (
              <tr key={`${r.period}-${r.direction}-${r.rate}`} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2">{r.period}</td>
                <td className="px-3 py-2">{r.direction === 'COLLECTED' ? 'Collectée' : 'Déductible'}</td>
                <td className="px-3 py-2 text-right">{formatRatePercent(r.ratePercent)}</td>
                <td className="px-3 py-2 text-right"><Amount value={r.base} /></td>
                <td className="px-3 py-2 text-right"><Amount value={r.vat} /></td>
              </tr>
            ))}
            {!recap.rows.length && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Aucune donnée sur la période.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm">
        <div className="p-4 border rounded bg-white">
          <h3 className="font-semibold text-gray-700 mb-2">Collectée</h3>
          <p>Base: <Amount value={recap.totals.collectedBase} /></p>
          <p>TVA : <Amount value={recap.totals.collectedVat} /></p>
        </div>
        <div className="p-4 border rounded bg-white">
          <h3 className="font-semibold text-gray-700 mb-2">Déductible</h3>
            <p>Base: <Amount value={recap.totals.deductibleBase} /></p>
            <p>TVA : <Amount value={recap.totals.deductibleVat} /></p>
        </div>
        <div className="p-4 border rounded bg-white">
          <h3 className="font-semibold text-gray-700 mb-2">Solde</h3>
          <p>TVA à payer: <Amount value={recap.totals.balanceVat} /></p>
        </div>
      </div>
    </main>
  );
}
