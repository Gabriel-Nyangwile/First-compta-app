"use client";
import { useState } from 'react';
import { authorizedFetch } from "@/lib/apiClient";

export default function GoodsReceiptCancelForm({ receipt }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [reason, setReason] = useState('');

  const toggleLine = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const allSelected = selected.size === receipt.lines.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set()); else setSelected(new Set(receipt.lines.map(l => l.id)));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setMessage(null); setLoading(true);
    try {
      const payload = {};
      if (selected.size > 0 && selected.size < receipt.lines.length) {
        payload.lines = Array.from(selected);
      }
      if (reason.trim()) payload.reason = reason.trim();
      const res = await authorizedFetch(`/api/goods-receipts/${receipt.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur annulation');
      setMessage(data.message || 'Annulé');
      // Refresh page to reflect updated stock / statuses
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 border rounded bg-white">
      <button type="button" onClick={() => setExpanded(e => !e)} className="w-full text-left px-3 py-2 text-xs font-medium flex justify-between items-center">
        <span>Annulation (totale ou sélective)</span>
        <span>{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-3 border-t">
          <form onSubmit={submit} className="space-y-3">
            {error && <div className="text-red-600 text-xs">{error}</div>}
            {message && <div className="text-green-700 text-xs">{message}</div>}
            <div className="text-[11px] text-gray-600">Laissez toutes les lignes décochées pour annuler complètement. Sélectionnez des lignes pour annuler seulement celles‑ci.</div>
            <table className="w-full text-[11px] border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-1 py-1 text-center"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th className="border px-1 py-1 text-left">Produit</th>
                  <th className="border px-1 py-1">Qté reçue</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map(l => (
                  <tr key={l.id}>
                    <td className="border px-1 py-1 text-center">
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleLine(l.id)} />
                    </td>
                    <td className="border px-1 py-1">{l.product?.name || l.productId}</td>
                    <td className="border px-1 py-1 text-right font-mono">{Number(l.qtyReceived).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif (optionnel)" className="w-full border rounded px-2 py-1 text-xs" rows={2} />
            </div>
            <div className="flex gap-2">
              <button disabled={loading} className="px-3 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50">{loading ? 'Annulation...' : 'Annuler sélection / totalité'}</button>
              <button type="button" onClick={() => { setSelected(new Set()); setReason(''); }} className="px-3 py-1 rounded bg-gray-200 text-xs">Reset</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
