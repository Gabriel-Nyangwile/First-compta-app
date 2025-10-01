"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProductsClient({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ sku:'', name:'', description:'', unit:'PCS' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [confirm, setConfirm] = useState(null); // { id, sku }
  const [filter, setFilter] = useState('');
  const [filtered, setFiltered] = useState(products);

  useEffect(()=>{
    const f = filter.trim().toLowerCase();
    if(!f) setFiltered(products);
    else setFiltered(products.filter(p => p.name.toLowerCase().includes(f) || p.sku.toLowerCase().includes(f)));
  },[products, filter]);

  function resetForm(){ setForm({ sku:'', name:'', description:'', unit:'PCS' }); setError(''); }
  function openModal(){ resetForm(); setModalOpen(true); setTimeout(()=>{ const inp=document.getElementById('new-prod-sku'); inp && inp.focus(); },30); }
  function toast(msg){ setInfo(msg); setTimeout(()=>setInfo(''),4000); }

  async function handleCreate(e){
    e.preventDefault(); setError('');
    if(!form.sku.trim() || !form.name.trim()){ setError('SKU et Nom requis'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, sku: form.sku.trim(), name: form.name.trim(), description: form.description || undefined, unit: form.unit||'PCS' }) });
      const data = await res.json();
      if(!res.ok){ setError(data.error||'Erreur création'); }
      else {
        setProducts(p=>[{ ...data, qtyOnHand:'0', avgCost:null }, ...p]);
        setModalOpen(false); toast(`Produit ${data.sku} créé`);
      }
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  }

  async function toggleActive(prod){
    try {
      const res = await fetch(`/api/products/${prod.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: !prod.isActive }) });
      const data = await res.json();
      if(!res.ok){ toast(data.error||'Erreur MAJ'); return; }
      setProducts(list=>list.map(p=>p.id===prod.id?{...p, isActive:data.isActive}:p));
    } catch { toast('Erreur réseau'); }
  }

  async function deleteProduct(id){
    try {
      const res = await fetch(`/api/products/${id}`, { method:'DELETE' });
      const data = await res.json();
      if(!res.ok){ toast(data.error||'Suppression impossible'); return; }
      setProducts(list=>list.filter(p=>p.id!==id));
      toast('Produit supprimé');
    } catch { toast('Erreur réseau'); }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Produits</h1>
        <div className="flex gap-2 items-center">
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtrer (nom ou SKU)" className="border px-2 py-1 rounded text-sm" />
          <button onClick={openModal} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">Nouveau produit</button>
          <Link href="/purchase-orders/create" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Créer BC</Link>
        </div>
      </div>
      {info && <div className="mb-4 text-xs px-3 py-2 rounded bg-slate-800 text-white inline-block">{info}</div>}
      <div className="overflow-x-auto border rounded bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-2">SKU</th>
              <th className="p-2">Nom</th>
              <th className="p-2 text-right">Stock</th>
              <th className="p-2 text-right">Coût moyen</th>
              <th className="p-2">Actif</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && <tr><td colSpan={6} className="p-4 text-center text-slate-500">Aucun produit</td></tr>}
            {filtered.map(p => (
              <tr key={p.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{p.sku}</td>
                <td className="p-2">{p.name}</td>
                <td className="p-2 text-right">{Number(p.qtyOnHand).toFixed(3)}</td>
                <td className="p-2 text-right">{p.avgCost != null ? Number(p.avgCost).toFixed(4) : '—'}</td>
                <td className="p-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${p.isActive? 'bg-emerald-100 text-emerald-700':'bg-gray-200 text-gray-600'}`}>{p.isActive?'Oui':'Non'}</span>
                </td>
                <td className="p-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={()=>toggleActive(p)} className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300">{p.isActive?'Désactiver':'Activer'}</button>
                  <button onClick={()=>setConfirm({id:p.id, sku:p.sku})} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 text-xs text-slate-500 space-y-1">
        <p>La suppression échouera si le produit est référencé (commandes, réceptions, factures). Dans ce cas désactivez-le.</p>
      </div>
      <div className="mt-4"><Link href="/" className="text-blue-600 underline text-sm">Retour Accueil</Link></div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 overflow-auto">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Nouveau produit</h2>
              <button onClick={()=>setModalOpen(false)} className="text-xs text-slate-500 hover:text-black">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs space-y-1">
                  <span className="font-medium">SKU *</span>
                  <input id="new-prod-sku" value={form.sku} onChange={e=>setForm(f=>({...f, sku:e.target.value}))} className="border px-2 py-1 rounded text-xs w-full" required />
                </label>
                <label className="text-xs space-y-1">
                  <span className="font-medium">Nom *</span>
                  <input value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} className="border px-2 py-1 rounded text-xs w-full" required />
                </label>
              </div>
              <label className="text-xs space-y-1 block">
                <span className="font-medium">Description</span>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} rows={2} className="border px-2 py-1 rounded text-xs w-full" />
              </label>
              <label className="text-xs space-y-1 block max-w-[120px]">
                <span className="font-medium">Unité</span>
                <input value={form.unit} onChange={e=>setForm(f=>({...f, unit:e.target.value}))} className="border px-2 py-1 rounded text-xs w-full" />
              </label>
              {error && <div className="text-xs text-red-600">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setModalOpen(false)} className="px-3 py-1 text-xs bg-gray-200 rounded">Annuler</button>
                <button disabled={loading} className="px-4 py-1 text-xs bg-emerald-600 text-white rounded disabled:opacity-50">{loading?'Création…':'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="bg-white rounded shadow p-5 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold">Confirmer suppression</h3>
            <p className="text-xs">Supprimer le produit <span className="font-mono">{confirm.sku}</span>? Cette action échouera si le produit est déjà utilisé.</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setConfirm(null)} className="px-3 py-1 text-xs bg-gray-200 rounded">Annuler</button>
              <button onClick={()=>{ deleteProduct(confirm.id); setConfirm(null); }} className="px-3 py-1 text-xs bg-red-600 text-white rounded">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
