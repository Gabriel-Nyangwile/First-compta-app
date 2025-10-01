"use client";
import { useState, useEffect } from 'react';

export default function GoodsReceiptForm({ purchaseOrders }) {
  const [poId, setPoId] = useState('');
  const [lines, setLines] = useState([]);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { setLines([]); }, [poId]);

  function addLine() {
    if (!productId || !qty) return;
    const q = Number(qty);
    const uc = unitCost ? Number(unitCost) : 0;
    if (isNaN(q) || q <= 0) return;
    setLines(l => [...l, { id: Math.random().toString(36).slice(2), productId, qtyReceived: q, unitCost: uc }]);
    setProductId(''); setQty(''); setUnitCost('');
  }
  async function submit() {
    setSubmitting(true); setMessage(null);
    try {
      const res = await fetch('/api/goods-receipts', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ purchaseOrderId: poId || undefined, lines: lines.map(l => ({ productId: l.productId, qtyReceived: l.qtyReceived, unitCost: l.unitCost })) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setMessage(`Réception créée (${data.number})`);
      setLines([]); setPoId('');
    } catch (e) { setMessage(e.message); }
    finally { setSubmitting(false); }
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Bon de commande (optionnel)</label>
        <select value={poId} onChange={e=>setPoId(e.target.value)} className="mt-1 border rounded px-2 py-1 w-full">
          <option value="">-- aucun --</option>
          {purchaseOrders.map(po => <option key={po.id} value={po.id}>{po.number}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium">Produit ID</label>
          <input value={productId} onChange={e=>setProductId(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" placeholder="productId" />
        </div>
        <div>
          <label className="block text-xs font-medium">Quantité</label>
          <input value={qty} onChange={e=>setQty(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
        </div>
        <div>
          <label className="block text-xs font-medium">Coût unitaire</label>
          <input value={unitCost} onChange={e=>setUnitCost(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
        </div>
        <button type="button" onClick={addLine} className="bg-blue-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50" disabled={!productId || !qty}>Ajouter</button>
      </div>
      <div>
        <h4 className="font-medium text-sm mb-1">Lignes</h4>
        <ul className="space-y-1 text-xs">
          {lines.map(l => <li key={l.id} className="flex items-center justify-between border rounded px-2 py-1"><span>{l.productId} : {l.qtyReceived} @ {l.unitCost}</span><button type="button" onClick={()=>setLines(ls=>ls.filter(x=>x.id!==l.id))} className="text-red-600">x</button></li>)}
          {!lines.length && <li className="text-slate-500 italic">Aucune ligne</li>}
        </ul>
      </div>
      <div>
        <button type="button" onClick={submit} disabled={!lines.length || submitting} className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">{submitting? 'En cours...' : 'Créer réception'}</button>
      </div>
      {message && <div className="text-sm" data-testid="message">{message}</div>}
    </div>
  );
}
