"use client";
import { useState } from 'react';

export default function NewMoneyAccountForm() {
  const [type, setType] = useState('BANK');
  const [label, setLabel] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      if (!label) throw new Error('Libellé requis');
      setLoading(true);
      const res = await fetch('/api/treasury/accounts/create', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ type, label, currency, openingBalance: Number(openingBalance), code: code || null }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur création compte');
      setOk('Compte créé');
      setLabel(''); setOpeningBalance('0'); setCode('');
      // reload to refresh list
      window.location.href = '/treasury';
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white border rounded p-4 text-sm">
      <h3 className="font-semibold text-sm">Nouveau compte trésorerie</h3>
      <label className="flex flex-col">Type
        <select value={type} onChange={e=>setType(e.target.value)} className="mt-1 border rounded px-2 py-1">
          <option value="BANK">Banque (521xxx)</option>
          <option value="CASH">Caisse (571xxx)</option>
        </select>
      </label>
      <label className="flex flex-col">Libellé
        <input value={label} onChange={e=>setLabel(e.target.value)} className="mt-1 border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col">Code interne (optionnel)
        <input
          value={code}
          onChange={e=>setCode(e.target.value)}
          className="mt-1 border rounded px-2 py-1"
          placeholder="Ex: BANQ1, SG-PRINC, CAISSE-USD, CCP-01..."
          maxLength={20}
        />
        <span className="mt-1 text-[10px] text-slate-500 leading-snug">Identifiant court interne pour filtrer / regrouper (aucun impact comptable). Laisser vide si non nécessaire.</span>
      </label>
      <label className="flex flex-col">Devise
        <input value={currency} onChange={e=>setCurrency(e.target.value)} className="mt-1 border rounded px-2 py-1" />
      </label>
      <label className="flex flex-col">Solde d'ouverture
        <input type="number" step="0.01" value={openingBalance} onChange={e=>setOpeningBalance(e.target.value)} className="mt-1 border rounded px-2 py-1" />
      </label>
      {error && <div className="text-red-600 text-xs">{error}</div>}
      {ok && <div className="text-green-600 text-xs">{ok}</div>}
      <button disabled={loading} className="px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 disabled:opacity-50" type="submit">{loading ? 'Création...' : 'Créer'}</button>
    </form>
  );
}
