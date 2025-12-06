'use client';

import { useRef, useState } from 'react';

function emptyLine() {
  return { label: '', assetCategoryId: '', quantity: '1', unitPrice: '', vatRate: '' };
}

export default function CreateForm({ suppliers = [], categories = [] }) {
  const [lines, setLines] = useState([emptyLine()]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [expectedDate, setExpectedDate] = useState('');
  const notesRef = useRef();
  const supplierRef = useRef();
  const currencyRef = useRef();

  function pushToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function updateLine(idx, patch) {
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  function addLine() { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(idx) {
    setLines(ls => ls.length === 1 ? [emptyLine()] : ls.filter((_, i) => i !== idx));
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    const supplierId = supplierRef.current?.value;
    if (!supplierId) return pushToast('Fournisseur requis', 'error');
    const payloadLines = lines
      .map(l => ({ ...l, quantity: l.quantity || '1' }))
      .filter(l => l.label || l.assetCategoryId || l.unitPrice)
      .filter(l => l.assetCategoryId && l.unitPrice);
    if (!payloadLines.length) return pushToast('Ajouter au moins une ligne valide', 'error');
    setLoading(true);
    try {
      const res = await fetch('/api/asset-purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          expectedDate: expectedDate || null,
          currency: currencyRef.current?.value || 'EUR',
          notes: notesRef.current?.value || null,
          lines: payloadLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Création échouée');
      pushToast('BC Immobilisation créé', 'success');
      window.location.href = '/asset-purchase-orders';
    } catch (err) {
      pushToast(err.message || 'Erreur réseau', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <label className="text-xs space-y-1">
          <span className="font-medium">Fournisseur</span>
          <select ref={supplierRef} className="border px-2 py-1 rounded text-sm" required>
            <option value="">Choisir</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="font-medium">Date attendue</span>
          <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="border px-2 py-1 rounded text-sm" />
        </label>
        <label className="text-xs space-y-1">
          <span className="font-medium">Devise</span>
          <input ref={currencyRef} defaultValue="EUR" className="border px-2 py-1 rounded text-sm" />
        </label>
      </div>
      <label className="text-xs space-y-1 block">
        <span className="font-medium">Notes</span>
        <textarea ref={notesRef} rows={2} className="border w-full rounded px-2 py-1 text-sm" />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">Lignes (immobilisations)</h2>
          <button type="button" onClick={addLine} className="px-3 py-1 bg-blue-600 text-white text-xs rounded">Ajouter ligne</button>
        </div>
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-7 gap-2 items-start border p-2 rounded">
              <input value={l.label} onChange={e => updateLine(idx, { label: e.target.value })} placeholder="Libellé immobilisation" className="border px-2 py-1 rounded text-xs col-span-2" />
              <select value={l.assetCategoryId} onChange={e => updateLine(idx, { assetCategoryId: e.target.value })} className="border px-2 py-1 rounded text-xs">
                <option value="">Catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code} · {c.label}</option>)}
              </select>
              <input value={l.quantity} onChange={e => updateLine(idx, { quantity: e.target.value })} type="number" step="0.001" className="border px-2 py-1 rounded text-xs" placeholder="Qté" />
              <input value={l.unitPrice} onChange={e => updateLine(idx, { unitPrice: e.target.value })} type="number" step="0.01" className="border px-2 py-1 rounded text-xs" placeholder="PU" />
              <input value={l.vatRate} onChange={e => updateLine(idx, { vatRate: e.target.value })} type="number" step="0.01" className="border px-2 py-1 rounded text-xs" placeholder="TVA" />
              <div className="flex flex-col items-end gap-1">
                <button type="button" onClick={() => removeLine(idx)} className="text-xs text-red-600">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gray-500">Saisir un libellé, sélectionner la catégorie, renseigner prix & TVA.</div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-60">{loading ? 'Création…' : 'Créer'}</button>
        <a href="/asset-purchase-orders" className="px-4 py-2 bg-gray-300 rounded text-sm">Annuler</a>
      </div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-xs px-3 py-2 rounded shadow text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>{toast.msg}</div>
      )}
    </form>
  );
}
