"use client";
import { useState } from 'react';

export default function TransferForm({ accounts }) {
  const [fromId, setFromId] = useState(accounts[0]?.id || '');
  const [toId, setToId] = useState(accounts[1]?.id || accounts[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  // voucherRef désormais auto-généré (sauf cas admin futur)
  const [voucherRef, setVoucherRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setOkMsg('');
    if (!fromId || !toId) { setError('Deux comptes requis'); return; }
    if (fromId === toId) { setError('Comptes identiques'); return; }
    if (!amount || Number(amount) <= 0) { setError('Montant invalide'); return; }
    try {
      setLoading(true);
  const res = await fetch('/api/treasury/transfers', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ fromMoneyAccountId: fromId, toMoneyAccountId: toId, amount: Number(amount), description }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur serveur');
      setOkMsg('Transfert créé');
  setAmount(''); setDescription(''); setVoucherRef('');
      window.location.href = `/treasury?account=${toId}`;
    } catch(err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white border rounded p-4">
      <h3 className="font-semibold text-sm">Transfert interne</h3>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <label className="flex flex-col">De
          <select value={fromId} onChange={e=>setFromId(e.target.value)} className="mt-1 border rounded px-2 py-1">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col">Vers
          <select value={toId} onChange={e=>setToId(e.target.value)} className="mt-1 border rounded px-2 py-1">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col">Montant
          <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" step="0.01" className="mt-1 border rounded px-2 py-1" required />
        </label>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="flex flex-col text-sm">Description
          <input value={description} onChange={e=>setDescription(e.target.value)} type="text" className="mt-1 border rounded px-2 py-1" />
        </label>
        <div className="flex flex-col text-sm text-[11px] text-slate-500">
          <span>Réf pièce</span>
          <span className="mt-1 px-2 py-1 border rounded bg-slate-50">Automatique</span>
        </div>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {okMsg && <div className="text-green-600 text-sm">{okMsg}</div>}
      <div className="flex gap-2">
        <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500 disabled:opacity-50" type="submit">{loading? 'En cours...' : 'Transférer'}</button>
      </div>
    </form>
  );
}
