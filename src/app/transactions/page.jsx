"use client";
import { useEffect, useState, useMemo } from 'react';
import Amount from '@/components/Amount.jsx';
import Link from 'next/link';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [showLineDescription, setShowLineDescription] = useState(true);
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    clientId: '', // conservé temporairement si besoin historique
    invoiceId: '',
    direction: '',
    kind: ''
  });
  const [sums, setSums] = useState({ debit: 0, credit: 0 });
  const [clients, setClients] = useState([]); // pourra être supprimé après retrait filtre
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Charger clients et invoices pour filtres
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.clients)) setClients(d.clients); else if (Array.isArray(d)) setClients(d); else setClients([]);
      });
    fetch('/api/invoices')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.invoices)) setInvoices(d.invoices); else if (Array.isArray(d)) setInvoices(d); else setInvoices([]);
      });
    fetch('/api/suppliers')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.suppliers)) setSuppliers(d.suppliers); else if (Array.isArray(d)) setSuppliers(d); else setSuppliers([]);
      });
  }, []);

  const buildQuery = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k,v]) => { if (v) params.append(k,v); });
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));
    return params.toString();
  };

  const fetchTransactions = () => {
    setLoading(true); setError('');
    fetch(`/api/transactions?${buildQuery()}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setTransactions([]); return; }
        setTransactions(Array.isArray(d.data) ? d.data : []);
        setTotalPages(d.totalPages || 1);
        setSums(d.sums || { debit:0, credit:0 });
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTransactions(); /* eslint-disable react-hooks/exhaustive-deps */ }, [page, pageSize]);

  const balance = useMemo(() => (sums.debit - sums.credit), [sums]);

  const resetFilters = () => {
    setFilters({ dateStart:'', dateEnd:'', clientId:'', invoiceId:'', direction:'', kind:'' });
    setPage(1);
  };

  const exportCsv = () => {
    if (!transactions.length) return;
  const baseHeaders = ['Date','Compte','Libellé']; // Libellé = label du compte
    if (showLineDescription) baseHeaders.push('Description ligne');
    const headers = [...baseHeaders,'Pièces justificatives','Direction','Type','Débit','Crédit'];
    const rows = transactions.map(t => {
      const debit = t.direction === 'DEBIT' ? t.amount : '';
      const credit = t.direction === 'CREDIT' ? t.amount : '';
      const row = [
        new Date(t.date).toISOString().split('T')[0],
        t.account?.number || '',
        t.account?.label || t.description || ''
      ];
      if (showLineDescription) row.push(t.lineDescription || '');
      const justificatif = t.invoice?.invoiceNumber || t.incomingInvoice?.entryNumber || '';
      row.push(justificatif, t.direction, t.kind, debit, credit);
      return row;
    });
    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().split('T')[0];
    a.download = `transactions_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Grouping by date with per-kind subtotals
  const grouped = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      const d = new Date(t.date); const key = d.toISOString().slice(0,10);
      if (!map.has(key)) map.set(key, { date: key, rows: [], debit:0, credit:0, kinds:{} });
      const g = map.get(key);
      g.rows.push(t);
      const amt = Number(t.amount);
      if (t.direction === 'DEBIT') g.debit += amt; else g.credit += amt;
      if (!g.kinds[t.kind]) g.kinds[t.kind] = { debit:0, credit:0 };
      if (t.direction === 'DEBIT') g.kinds[t.kind].debit += amt; else g.kinds[t.kind].credit += amt;
    }
    // Preserve original order (transactions sorted desc by date) -> iterate in that order adding groups
    const orderedKeys = [];
    for (const t of transactions) {
      const key = new Date(t.date).toISOString().slice(0,10); if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }
    return orderedKeys.map(k => map.get(k));
  }, [transactions]);

  const [groupView, setGroupView] = useState(true);

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Transactions</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-4 rounded shadow border">
            <h2 className="font-semibold mb-2 text-sm">Filtres</h2>
            <div className="space-y-2 text-sm">
              <div>
                <label className="block">Date début</label>
                <input type="date" value={filters.dateStart} onChange={e=>setFilters(f=>({...f,dateStart:e.target.value}))} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block">Date fin</label>
                <input type="date" value={filters.dateEnd} onChange={e=>setFilters(f=>({...f,dateEnd:e.target.value}))} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="block">Client</label>
                <select value={filters.clientId} onChange={e=>setFilters(f=>({...f,clientId:e.target.value}))} className="w-full border rounded px-2 py-1">
                  <option value="">--</option>
                  {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block">Facture</label>
                <select value={filters.invoiceId} onChange={e=>setFilters(f=>({...f,invoiceId:e.target.value}))} className="w-full border rounded px-2 py-1">
                  <option value="">--</option>
                  {invoices.map(inv=> <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="block">Direction</label>
                <select value={filters.direction} onChange={e=>setFilters(f=>({...f,direction:e.target.value}))} className="w-full border rounded px-2 py-1">
                  <option value="">--</option>
                  <option value="DEBIT">Débit</option>
                  <option value="CREDIT">Crédit</option>
                </select>
              </div>
              <div>
                <label className="block">Type</label>
                <select value={filters.kind} onChange={e=>setFilters(f=>({...f,kind:e.target.value}))} className="w-full border rounded px-2 py-1">
                  <option value="">--</option>
                  <option value="RECEIVABLE">Créance</option>
                  <option value="SALE">Vente</option>
                  <option value="VAT_COLLECTED">TVA</option>
                  <option value="PAYMENT">Paiement</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={()=>{ setPage(1); fetchTransactions(); }} className="flex-1 bg-blue-600 text-white text-xs px-2 py-1 rounded">Appliquer</button>
                <button onClick={()=>{ resetFilters(); setTimeout(()=>fetchTransactions(),0); }} className="flex-1 border text-xs px-2 py-1 rounded">Réinitialiser</button>
              </div>
            </div>
          </div>
          <div className="md:col-span-3 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-white rounded shadow border p-3 text-sm">
                <div>Total Débits: <span className="font-semibold"><Amount value={sums.debit} /></span></div>
                <div>Total Crédits: <span className="font-semibold"><Amount value={sums.credit} /></span></div>
                <div>Solde: <span className={`font-semibold ${balance >= 0 ? 'text-green-600':'text-red-600'}`}><Amount value={balance} /></span></div>
              </div>
              <div className="ml-auto flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1 shadow-sm">
                  <input type="checkbox" checked={showLineDescription} onChange={e=>setShowLineDescription(e.target.checked)} />
                  <span>Col. description</span>
                </label>
                <label className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1 shadow-sm">
                  <input type="checkbox" checked={groupView} onChange={e=>setGroupView(e.target.checked)} />
                  <span>Groupé par date</span>
                </label>
                <button onClick={exportCsv} disabled={!transactions.length} className="bg-green-600 disabled:opacity-40 text-white px-4 py-2 rounded text-sm">Export CSV</button>
                <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm">
                  {[20,50,100].map(s => <option key={s} value={s}>{s}/page</option>)}
                </select>
              </div>
            </div>
            <div className="bg-white rounded shadow border overflow-auto">
              {!groupView && (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Compte</th>
                      <th className="px-3 py-2 text-left">Libellé</th>
                      {showLineDescription && <th className="px-3 py-2 text-left">Article (description ligne)</th>}
                      <th className="px-3 py-2 text-left">Pièce</th>
                      <th className="px-3 py-2 text-right">Débit</th>
                      <th className="px-3 py-2 text-right">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (<tr><td colSpan={showLineDescription ? 8:7} className="px-3 py-4 text-center">Chargement…</td></tr>)}
                    {!loading && !transactions.length && (<tr><td colSpan={showLineDescription ? 8:7} className="px-3 py-4 text-center text-gray-400">Aucune écriture</td></tr>)}
                    {!loading && transactions.map(t => {
                      const isDebit = t.direction === 'DEBIT';
                      return (
                        <tr key={t.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{t.account?.number}</td>
                          <td className="px-3 py-2">{t.account?.label || t.description || ''}</td>
                          {showLineDescription && <td className="px-3 py-2 text-xs max-w-xs whitespace-pre-wrap">{(['SALE','PURCHASE'].includes(t.kind)?(t.lineDescription||'-'):'-')}</td>}
                          <td className="px-3 py-2">{t.invoice?.invoiceNumber || t.incomingInvoice?.entryNumber || ''}</td>
                          <td className={`px-3 py-2 text-right ${isDebit ? 'text-blue-700 font-medium':''}`}>{isDebit ? <Amount value={t.amount} />:''}</td>
                          <td className={`px-3 py-2 text-right ${!isDebit ? 'text-orange-700 font-medium':''}`}>{!isDebit ? <Amount value={t.amount} />:''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {groupView && (
                <div className="divide-y">
                  {loading && <div className="p-4 text-center text-gray-500">Chargement…</div>}
                  {!loading && !grouped.length && <div className="p-4 text-center text-gray-400">Aucune écriture</div>}
                  {!loading && grouped.map(group => (
                    <div key={group.date} className="p-0">
                      <div className={`px-3 py-2 flex items-center gap-4 text-sm font-semibold ${ (group.debit-group.credit)!==0 ? 'bg-red-200' : 'bg-gray-100' }`}>
                        <span>{new Date(group.date).toLocaleDateString()}</span>
                        <span className="ml-auto flex items-center gap-3">
                          <span>Débits: <Amount value={group.debit} /></span>
                          <span>Crédits: <Amount value={group.credit} /></span>
                          <span>Delta: <span className={(group.debit-group.credit)!==0?'text-red-700':'text-green-700'}>{(group.debit-group.credit).toFixed(2)}</span></span>
                          {(group.debit-group.credit)!==0 && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">ALERTE</span>}
                        </span>
                      </div>
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="px-2 py-1 text-left w-20">Compte</th>
                            <th className="px-2 py-1 text-left">Libellé</th>
                            {showLineDescription && <th className="px-2 py-1 text-left">Article</th>}
                            <th className="px-2 py-1 text-left">Pièce</th>
                            <th className="px-2 py-1 text-left">Kind</th>
                            <th className="px-2 py-1 text-right">Débit</th>
                            <th className="px-2 py-1 text-right">Crédit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map(r => {
                            const isDebit = r.direction === 'DEBIT';
                            return (
                              <tr key={r.id} className="border-b hover:bg-gray-50">
                                <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap">{r.account?.number}</td>
                                <td className="px-2 py-1">{r.account?.label || r.description || ''}</td>
                                {showLineDescription && <td className="px-2 py-1 max-w-xs whitespace-pre-wrap">{(['SALE','PURCHASE'].includes(r.kind)?(r.lineDescription||'-'):'-')}</td>}
                                <td className="px-2 py-1">{r.invoice?.invoiceNumber || r.incomingInvoice?.entryNumber || ''}</td>
                                <td className="px-2 py-1 text-[10px]">{r.kind}</td>
                                <td className={`px-2 py-1 text-right ${isDebit?'text-blue-700 font-medium':''}`}>{isDebit ? <Amount value={r.amount} />:''}</td>
                                <td className={`px-2 py-1 text-right ${!isDebit?'text-orange-700 font-medium':''}`}>{!isDebit ? <Amount value={r.amount} />:''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td colSpan={showLineDescription?5:4} className="px-2 py-1 text-right font-semibold">Sous-total</td>
                            <td className="px-2 py-1 text-right font-semibold"><Amount value={group.debit} /></td>
                            <td className="px-2 py-1 text-right font-semibold"><Amount value={group.credit} /></td>
                          </tr>
                          <tr>
                            <td colSpan={showLineDescription?7:6} className="px-2 py-1">
                              <div className="flex flex-wrap gap-3 text-[10px]">
                                {Object.entries(group.kinds).map(([k,v]) => (
                                  <span key={k} className="bg-gray-200 rounded px-2 py-0.5">{k}: D {v.debit.toFixed(2)} / C {v.credit.toFixed(2)}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1 border rounded disabled:opacity-40">Précédent</button>
              <span>Page {page} / {totalPages}</span>
              <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </div>
        {error && <div className="text-red-600 text-sm mt-4">{error}</div>}
        <div className="mt-12 flex justify-center">
          <Link href="/dashboard" className="px-6 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow">
            Retour au Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
