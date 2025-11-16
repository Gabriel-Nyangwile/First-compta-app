"use client";
import { useEffect, useState, use as usePromise } from 'react';
import Amount from '@/components/Amount.jsx';
import Link from 'next/link';

export default function SupplierLedgerPage({ params }) {
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
    fetch(`/api/suppliers/${id}/ledger?`+qs.toString())
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
    window.location.href = `/api/suppliers/${id}/ledger/csv?`+qs.toString();
  };
  const exportPdf = () => {
    const qs = new URLSearchParams();
    if (filters.dateStart) qs.append('dateStart', filters.dateStart);
    if (filters.dateEnd) qs.append('dateEnd', filters.dateEnd);
    if (filters.includeDetails) qs.append('includeDetails','1');
    window.location.href = `/api/suppliers/${id}/ledger/pdf?`+qs.toString();
  };

  const [uiPrefs, setUiPrefs] = useState({ highlightPayments:true, highlightVat:true, groupSpacing:true });

  const toggle = (k) => setUiPrefs(p=> ({...p, [k]: !p[k]}));

  // Helper: group lines by invoiceRef for optional separators
  const groupedRows = () => {
    if (!data?.rows) return [];
    const arr = [];
    let currentRef = null; let bucket = [];
    for (const r of data.rows) {
      if (r.invoiceRef !== currentRef) {
        if (bucket.length) arr.push({ ref: currentRef, rows: bucket });
        currentRef = r.invoiceRef; bucket = [r];
      } else bucket.push(r);
    }
    if (bucket.length) arr.push({ ref: currentRef, rows: bucket });
    return arr;
  };

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Grand Livre Fournisseur {data?.partyName ? ` ${data.partyName}` : ''} {data?.partyAccountNumber ? <span className="text-sm font-mono text-gray-500 ml-2">({data.partyAccountNumber}{data?.partyAccountLabel ? ' '+data.partyAccountLabel : ''})</span> : null}</h1>
          <Link href={`/suppliers/${id}`} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm">Lettrage</Link>
          <Link href="/suppliers" className="ml-auto bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">Retour</Link>
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
              <span>Inclure achats (PURCHASE)</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={load} className="flex-1 bg-blue-600 text-white text-xs px-2 py-1 rounded">Appliquer</button>
              <button onClick={()=>{ setFilters({dateStart:'',dateEnd:'',includeDetails:false}); setTimeout(load,0); }} className="flex-1 border text-xs px-2 py-1 rounded">Reset</button>
            </div>
            <div className="pt-4 flex flex-col gap-2 border-t">
              <button onClick={exportCsv} disabled={!data} className="bg-green-600 disabled:opacity-40 text-white px-3 py-1 rounded text-xs">Export CSV</button>
              <button onClick={exportPdf} disabled={!data} className="bg-indigo-600 disabled:opacity-40 text-white px-3 py-1 rounded text-xs">Export PDF</button>
            </div>
            <div className="pt-4 space-y-2 text-xs border-t">
              <div className="font-semibold text-gray-700">Affichage</div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={uiPrefs.highlightPayments} onChange={()=>toggle('highlightPayments')} /> Mettre en évidence paiements</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={uiPrefs.highlightVat} onChange={()=>toggle('highlightVat')} /> Mettre en évidence TVA</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={uiPrefs.groupSpacing} onChange={()=>toggle('groupSpacing')} /> Espacement par facture</label>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-col gap-4">
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div className="bg-white p-3 rounded shadow border space-y-1">
                <div className="font-semibold text-gray-700">Soldes</div>
                <div>Ouverture: <span className="font-semibold">{data ? <Amount value={data.opening} /> : '—'}</span></div>
                <div>Débits période: <span className="font-semibold">{data ? <Amount value={data.totals.debit} /> : '—'}</span></div>
                <div>Crédits période: <span className="font-semibold">{data ? <Amount value={data.totals.credit} /> : '—'}</span></div>
                <div>Clôture: <span className="font-semibold">{data ? <Amount value={data.closing} /> : '—'}</span></div>
              </div>
              <div className="bg-white p-3 rounded shadow border space-y-1">
                <div className="font-semibold text-gray-700">Compte Fournisseur</div>
                <div>Numéro: <span className="font-mono">{data?.partyAccountNumber || '-'}</span></div>
                <div>Libellé: {data?.partyAccountLabel || '-'}</div>
                <div>Délai (jours): {data?.partyMeta?.paymentDelay ?? '-'}</div>
              </div>
              <div className="bg-white p-3 rounded shadow border space-y-1">
                <div className="font-semibold text-gray-700">Contact</div>
                <div>Email: {data?.partyMeta?.email || '-'}</div>
                <div>Nature paiement: {data?.partyMeta?.paymentNature || '-'}</div>
              </div>
            </div>
            <div className="bg-white rounded shadow border overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Compte c/p</th>
                    <th className="px-2 py-2 text-left">Libellé c/p</th>
                    <th className="px-2 py-2 text-left">Pièce (Facture)</th>
                    <th className="px-2 py-2 text-left">Réf Paiement / Encaissement</th>
                    <th className="px-2 py-2 text-left">Statut</th>
                    <th className="px-2 py-2 text-right">Débit</th>
                    <th className="px-2 py-2 text-right">Crédit</th>
                    <th className="px-2 py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">Chargement…</td></tr>}
                  {!loading && data && !data.rows.length && <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">Aucune écriture</td></tr>}
                  {!loading && data && groupedRows().map(group => {
                    const lastIdx = group.rows.length -1;
                    return group.rows.map((r, idx) => {
                      const isGroupLast = idx === lastIdx;
                      const highlightPayment = uiPrefs.highlightPayments && r.isPayment;
                      const highlightVat = uiPrefs.highlightVat && r.isVat;
                      const rowClasses = [
                        'border-b','hover:bg-gray-50','transition-colors'
                      ];
                      if (highlightPayment) rowClasses.push('bg-emerald-50');
                      if (highlightVat) rowClasses.push('bg-amber-50');
                      if (r.isInvoiceLast && !r.isPayment) rowClasses.push('font-medium');
                      if (uiPrefs.groupSpacing && isGroupLast) rowClasses.push('border-b-4','border-b-gray-300');
                      return (
                        <tr key={r.id} className={rowClasses.join(' ')}>
                          <td className="px-2 py-1 whitespace-nowrap text-gray-700">{new Date(r.date).toLocaleDateString()}</td>
                          <td className="px-2 py-1 font-mono text-xs">{r.accountNumber}</td>
                          <td className="px-2 py-1" title={r.linesPreview || undefined}>
                            {r.description}
                            {r.linesPreview ? <span className="ml-1 text-[10px] text-gray-400">ⓘ</span> : null}
                            {highlightPayment && <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">PAIEMENT</span>}
                            {highlightVat && r.isVat && <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px]">TVA</span>}
                            {r.isInvoiceLast && !r.isPayment && <span className="ml-2 inline-block px-1 py-0.5 rounded bg-gray-200 text-[10px] text-gray-700">Dernière ligne facture</span>}
                          </td>
                          <td className="px-2 py-1 text-xs">{r.invoiceRef || ''}</td>
                          <td className="px-2 py-1 text-[10px] font-mono">{r.paymentRef || ''}</td>
                          <td className="px-2 py-1 text-xs">{r.invoiceStatus || ''}</td>
                          <td className="px-2 py-1 text-right text-blue-700">{r.debit !== null ? <Amount value={r.debit} /> : ''}</td>
                          <td className="px-2 py-1 text-right text-orange-700">{r.credit !== null ? <Amount value={r.credit} /> : ''}</td>
                          <td className={"px-2 py-1 text-right font-semibold " + (r.running >= 0 ? 'text-green-600' : 'text-red-600')}><Amount value={r.running} /></td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
