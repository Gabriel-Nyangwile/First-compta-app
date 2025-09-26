"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Amount from '@/components/Amount.jsx';

export default function IncomingInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=> {
    fetch('/api/incoming-invoices')
      .then(r=>r.json())
      .then(d=> { if (d.error) setError(d.error); else setInvoices(d.invoices || []); })
      .catch(()=>setError('Erreur chargement'))
      .finally(()=>setLoading(false));
  }, []);

  const [showPayModal, setShowPayModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');

  useEffect(()=> {
    // Charger comptes bancaires (filtrage simple: numéro commence par 512)
    fetch('/api/accounts').then(r=>r.json()).then(d=>{
      const arr = Array.isArray(d) ? d : (Array.isArray(d.accounts)? d.accounts: []);
      setBankAccounts(arr.filter(a=> a.number && a.number.startsWith('512')));
    }).catch(()=>{});
  },[]);

  const openPay = (inv) => {
    setSelectedInvoice(inv);
    const alreadyPaid = (inv.transactions||[]).filter(t=> t.kind==='PAYMENT').reduce((s,t)=> s + Number(t.amount),0);
    const remaining = Number(inv.totalAmount) - alreadyPaid;
    setPayAmount(remaining.toFixed(2));
    setShowPayModal(true);
  };

  const doPay = async() => {
    if(!selectedInvoice) return; if(!bankAccountId) { setError('Compte banque requis'); return; }
    setPaying(true); setError('');
    try {
      const res = await fetch(`/api/incoming-invoices/${selectedInvoice.id}/settle`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ amount: payAmount, bankAccountId }) });
      const data = await res.json();
      if(!res.ok) { setError(data.error||'Erreur règlement'); }
      else {
        // rafraîchir liste
        fetch('/api/incoming-invoices').then(r=>r.json()).then(d=> setInvoices(d.invoices||[]));
        setShowPayModal(false);
      }
    } catch { setError('Erreur réseau'); }
    finally { setPaying(false); }
  };

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Factures Fournisseurs Reçues</h1>
          <Link href="/incoming-invoices/create" className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">Nouvelle facture reçue</Link>
          <Link href="/suppliers" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">Fournisseurs</Link>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="bg-white rounded shadow border overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left">Entry #</th>
                <th className="px-3 py-2 text-left">Num. Fournisseur</th>
                <th className="px-3 py-2 text-left">Fournisseur</th>
                <th className="px-3 py-2 text-left">Date réception</th>
                <th className="px-3 py-2 text-left">Total TTC</th>
                <th className="px-3 py-2 text-left">Payé</th>
                <th className="px-3 py-2 text-left">Reste</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">Chargement…</td></tr>}
              {!loading && !invoices.length && <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400">Aucune facture</td></tr>}
              {!loading && invoices.map(inv => {
                const paid = Number(inv.paidAmount||0);
                const remaining = Number(inv.outstandingAmount ?? (Number(inv.totalAmount||0) - paid));
                const pct = inv.totalAmount > 0 ? Math.min(100, Math.round(paid/Number(inv.totalAmount)*100)) : 0;
                return (
                <tr key={inv.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{inv.entryNumber}</td>
                  <td className="px-3 py-2">{inv.supplierInvoiceNumber}</td>
                  <td className="px-3 py-2">{inv.supplier?.name || '-'}</td>
                  <td className="px-3 py-2">{new Date(inv.receiptDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2"><Amount value={inv.totalAmount} /></td>
                  <td className="px-3 py-2"><Amount value={paid} /></td>
                  <td className="px-3 py-2"><Amount value={remaining} /></td>
                  <td className="px-3 py-2">{inv.status}{inv.status!=='PAID' && inv.status!=='PENDING' && inv.status!=='OVERDUE' && inv.status!=='PARTIAL' ? '' : ''}
                    <div className="mt-1 h-1.5 bg-gray-200 rounded overflow-hidden"><div className={"h-full "+(pct===100?'bg-green-500':'bg-indigo-500')} style={{width:`${pct}%`}}></div></div>
                  </td>
                  <td className="px-3 py-2 flex gap-2 flex-wrap">
                    <Link href={`/incoming-invoices/edit/${inv.id}`} className="text-xs text-blue-600 underline">Modifier</Link>
                    {inv.status !== 'PAID' && <button onClick={()=>openPay(inv)} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded">Régler</button>}
                    {inv.status !== 'PAID' && remaining>0 && <a href={`/treasury?quickIncoming=${inv.id}`} className="text-xs text-emerald-600 underline">Payer restant</a>}
                    <a
                      href={`/api/incoming-invoices/${inv.id}/pdf`}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded"
                    >PDF</a>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        {showPayModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm flex flex-col gap-4 text-sm">
              <h2 className="font-semibold">Règlement {selectedInvoice.entryNumber}</h2>
              <div>
                <label className="block mb-1">Montant</label>
                <input value={payAmount} onChange={e=>setPayAmount(e.target.value)} type="number" step="0.01" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block mb-1">Compte banque (512)</label>
                <select value={bankAccountId} onChange={e=>setBankAccountId(e.target.value)} className="w-full border rounded px-3 py-2">
                  <option value="">--</option>
                  {bankAccounts.map(b=> <option key={b.id} value={b.id}>{b.number} - {b.label}</option>)}
                </select>
              </div>
              {error && <div className="text-red-600 text-xs">{error}</div>}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={()=>setShowPayModal(false)} type="button" className="px-3 py-1 border rounded">Annuler</button>
                <button disabled={paying} onClick={doPay} type="button" className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40">{paying? 'Traitement...' : 'Confirmer'}</button>
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-center mt-8">
          <Link href="/dashboard" className="px-6 py-3 rounded bg-gray-600 hover:bg-gray-700 text-white font-semibold shadow">Retour Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
