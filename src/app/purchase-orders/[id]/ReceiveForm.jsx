"use client";
import { useState } from 'react';
import { authorizedFetch } from "@/lib/apiClient";

export default function ReceiveForm({ poId, remaining }) {
  const [lines, setLines] = useState(remaining.remainingLines.map(l => ({
    id: l.id,
    productId: l.productId,
    productName: l.product?.name || l.productId,
    remainingQty: l.remainingQty,
    version: l.version, // expected version for optimistic locking
    qty: ''
  })));
  const [unitCosts, setUnitCosts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const updateLineQty = (id, value) => {
    setLines(ls => ls.map(l => l.id === id ? { ...l, qty: value } : l));
  };

  const updateUnitCost = (id, value) => {
    setUnitCosts(c => ({ ...c, [id]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setMessage(null); setLoading(true);
    try {
      const payload = {
        purchaseOrderId: poId,
        lines: lines.filter(l => l.qty && Number(l.qty) > 0).map(l => ({
          productId: l.productId,
          purchaseOrderLineId: l.id,
          qtyReceived: Number(l.qty),
          unitCost: Number(unitCosts[l.id] || 0),
          version: l.version
        }))
      };
      if (!payload.lines.length) {
        setError('Aucune ligne avec quantité > 0');
        setLoading(false);
        return;
      }
      const res = await authorizedFetch('/api/goods-receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur réception');
      setMessage(`Réception créée: ${data.number}`);
      // Reset form lines for ones fully received
      setLines(ls => ls.map(l => ({ ...l, qty: '' })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-semibold text-sm">Réception partielle</h3>
      {error && <div className="text-red-600 text-xs">{error}</div>}
      {message && <div className="text-green-700 text-xs">{message}</div>}
      <form onSubmit={submit} className="space-y-3">
        <table className="w-full text-xs border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-1 py-1 text-left">Produit</th>
              <th className="border px-1 py-1">Reste</th>
              <th className="border px-1 py-1">Qté à recevoir</th>
              <th className="border px-1 py-1">PU (coût)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id}>
                <td className="border px-1 py-1">{l.productName}</td>
                <td className="border px-1 py-1 text-right font-mono">{Number(l.remainingQty).toFixed(3)}</td>
                <td className="border px-1 py-1">
                  <input type="number" step="0.001" min="0" max={l.remainingQty} value={l.qty} onChange={e => updateLineQty(l.id, e.target.value)} className="w-full border px-1 py-0.5 text-right" />
                </td>
                <td className="border px-1 py-1">
                  <input type="number" step="0.0001" min="0" value={unitCosts[l.id]||''} onChange={e => updateUnitCost(l.id, e.target.value)} className="w-full border px-1 py-0.5 text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2">
          <button disabled={loading} className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50">{loading ? 'Envoi...' : 'Créer réception'}</button>
        </div>
      </form>
    </div>
  );
}
