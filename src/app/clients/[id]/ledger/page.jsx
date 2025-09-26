"use client";
import { useEffect, useState, use as usePromise } from 'react';
import Amount from '@/components/Amount';
import Link from 'next/link';

export default function ClientLedgerPage({ params }) {
  // Next.js 15: params is now a Promise for RSC interop; unwrap with React.use
  const { id } = usePromise(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ dateStart:'', dateEnd:'', includeDetails:false });

  const load = () => {
    setLoading(true); setError('');
    const qs = new URLSearchParams();
    if (filters.dateStart) qs.append('dateStart', filters.dateStart);
    if (filters.dateEnd) qs.append('dateEnd', filters.dateEnd);
    if (filters.includeDetails) qs.append('includeDetails','1');
    fetch(`/api/clients/${id}/ledger?`+qs.toString())
      .then(r=>r.json())
      .then(d=>{ if (d.error) setError(d.error); else setData(d); })
      .catch(()=>setError('Erreur chargement'))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); /* eslint-disable react-hooks/exhaustive-deps */ },[]);

  const exportCsv = () => {
    const qs = new URLSearchParams();
    if (filters.dateStart) qs.append('dateStart', filters.dateStart);
    if (filters.dateEnd) qs.append('dateEnd', filters.dateEnd);
    if (filters.includeDetails) qs.append('includeDetails','1');
    window.location.href = `/api/clients/${id}/ledger/csv?`+qs.toString();
  };
  const exportPdf = () => {
    const qs = new URLSearchParams();
    if (filters.dateStart) qs.append('dateStart', filters.dateStart);
    if (filters.dateEnd) qs.append('dateEnd', filters.dateEnd);
    if (filters.includeDetails) qs.append('includeDetails','1');
    window.location.href = `/api/clients/${id}/ledger/pdf?`+qs.toString();
  };

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Grand Livre Client {data?.partyName ? `– ${data.partyName}` : ''} {data?.partyAccountNumber ? <span className="text-sm font-mono text-gray-500 ml-2">({data.partyAccountNumber}{data?.partyAccountLabel ? ' '+data.partyAccountLabel : ''})</span> : null}</h1>
          <Link href="/clients" className="ml-auto bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">Retour</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded shadow border text-sm space-y-3">
            <h2 className="font-semibold text-sm">Filtres</h2>
            <div>
              <label className="block mb-1">Date début</label>
              <input type="date" value={filters.dateStart} onChange={e=>setFilters(f=>({...f,dateStart:e.target.value}))} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block mb-1">Date fin</label>
              <input type="date" value={filters.dateEnd} onChange={e=>setFilters(f=>({...f,dateEnd:e.target.value}))} className="w-full border rounded px-2 py-1" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={filters.includeDetails} onChange={e=>setFilters(f=>({...f,includeDetails:e.target.checked}))} />
              <span>Inclure ventes (SALE)</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={load} className="flex-1 bg-blue-600 text-white text-xs px-2 py-1 rounded">Appliquer</button>
              <button onClick={()=>{ setFilters({dateStart:'',dateEnd:'',includeDetails:false}); setTimeout(load,0); }} className="flex-1 border text-xs px-2 py-1 rounded">Reset</button>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <button onClick={exportCsv} disabled={!data} className="bg-green-600 disabled:opacity-40 text-white px-3 py-1 rounded text-xs">Export CSV</button>
              <button onClick={exportPdf} disabled={!data} className="bg-indigo-600 disabled:opacity-40 text-white px-3 py-1 rounded text-xs">Export PDF</button>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-col gap-4">
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="bg-white p-3 rounded shadow border space-y-1">
                <div className="font-semibold text-gray-700">Soldes</div>
                <div>Ouverture: <span className="font-semibold"><Amount value={data ? data.opening : 0} /></span></div>
                <div>Débits période: <span className="font-semibold"><Amount value={data ? data.totals.debit : 0} /></span></div>
                <div>Crédits période: <span className="font-semibold"><Amount value={data ? data.totals.credit : 0} /></span></div>
                <div>Clôture: <span className="font-semibold"><Amount value={data ? data.closing : 0} /></span></div>
              </div>
              <div className="bg-white p-3 rounded shadow border space-y-1">
                <div className="font-semibold text-gray-700">Compte Client</div>
                <div>Numéro: <span className="font-mono">{data?.partyAccountNumber || '-'}</span></div>
                <div>Libellé: {data?.partyAccountLabel || '-'}</div>
                <div>Catégorie: {data?.partyMeta?.category || '-'}</div>
              </div>
              <div className="bg-white p-3 rounded shadow border space-y-1">
                <div className="font-semibold text-gray-700">Contact</div>
                <div>Email: {data?.partyMeta?.email || '-'}</div>
                <div className="truncate">Adresse: {data?.partyMeta?.address ? data.partyMeta.address.split('\n')[0] : '-'}</div>
              </div>
            </div>
            <div className="bg-white rounded shadow border overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Compte</th>
                    <th className="px-2 py-2 text-left">Libellé</th>
                    <th className="px-2 py-2 text-left">Pièce</th>
                    <th className="px-2 py-2 text-left">Réf Paiement</th>
                    <th className="px-2 py-2 text-left">Mouv.</th>
                    <th className="px-2 py-2 text-left">Statut</th>
                    <th className="px-2 py-2 text-right">Débit</th>
                    <th className="px-2 py-2 text-right">Crédit</th>
                    <th className="px-2 py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">Chargement…</td></tr>}
                  {!loading && data && !data.rows.length && <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">Aucune écriture</td></tr>}
                  {!loading && data && data.rows.map(r => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-2 py-1 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="px-2 py-1 font-mono">{r.accountNumber}</td>
                      <td className="px-2 py-1" title={r.linesPreview || undefined}>{r.description}{r.linesPreview ? <span className="ml-1 text-[10px] text-gray-400">ⓘ</span> : null}</td>
                      <td className="px-2 py-1">{r.invoiceRef || ''}</td>
                      <td className="px-2 py-1 text-xs">{r.paymentRef || ''}</td>
                      <td className="px-2 py-1 text-[10px] font-mono">{r.movementId ? r.movementId.slice(0,8) : ''}</td>
                      <td className="px-2 py-1">{r.invoiceStatus || ''}</td>
                      <td className="px-2 py-1 text-right text-blue-700">{r.debit !== null ? <Amount value={r.debit} /> : ''}</td>
                      <td className="px-2 py-1 text-right text-orange-700">{r.credit !== null ? <Amount value={r.credit} /> : ''}</td>
                      <td className={"px-2 py-1 text-right font-semibold " + (r.running >= 0 ? 'text-green-600' : 'text-red-600')}><Amount value={r.running} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
