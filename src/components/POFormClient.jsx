"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { authorizedFetch } from "@/lib/apiClient";

function useDebounce(fn, ms){
  const t = useRef();
  return useCallback((...a)=>{ clearTimeout(t.current); t.current = setTimeout(()=>fn(...a), ms); }, [fn, ms]);
}

export default function POFormClient({ suppliers, initialProducts, assetCategories = [] }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [lines, setLines] = useState([emptyLine()]);
  const [showModal, setShowModal] = useState(false);
  const [activeLine, setActiveLine] = useState(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const supplierRef = useRef();

  function emptyLine(){ return { productId: '', orderedQty: '', unitPrice: '', vatRate: '', assetCategoryId: '' }; }

  function pushToast(msg, type='info'){
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(()=> setToast(null), 4000);
  }

  function updateLine(idx, patch){
    setLines(ls => ls.map((l,i)=> i===idx ? { ...l, ...patch } : l));
  }

  function addLine(focus=true){
    setLines(ls => [...ls, emptyLine()]);
  }

  function removeLine(idx){
    setLines(ls => ls.length === 1 ? [emptyLine()] : ls.filter((_,i)=>i!==idx));
  }

  // Auto add new line when all existing have a productId and last changed selects one
  useEffect(()=>{
    if (lines.length === 0) return; 
    const allHave = lines.every(l => l.productId);
    if (allHave) setLines(ls => [...ls, emptyLine()]);
  }, [lines.map(l=>l.productId).join('|')]);

  // Prevent duplicate products
  function handleProductChange(idx, value){
    if (value && lines.some((l,i)=> i!==idx && l.productId === value)) {
      pushToast('Produit déjà utilisé', 'error');
      updateLine(idx, { productId: '' });
      return;
    }
    updateLine(idx, { productId: value });
  }

  async function refreshProducts(){
    try {
      const res = await fetch('/api/products?ts=' + Date.now(), { cache: 'no-store' });
      if(!res.ok) return pushToast('Échec rafraîchissement produits','error');
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      setProducts(arr);
      pushToast('Produits rafraîchis','success');
    } catch { pushToast('Erreur réseau produits','error'); }
  }

  const debouncedSearch = useDebounce(async (q, idx)=>{
    if(!q || q.trim().length < 2) return; // no fetch for tiny queries
    try {
      const res = await fetch('/api/products?q=' + encodeURIComponent(q) + '&ts=' + Date.now(), { cache: 'no-store' });
      if(!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      setProducts(current => {
        // Merge: ensure new results included; keep existing for previously selected
        const map = new Map(current.map(p=>[p.id,p]));
        arr.forEach(p=> map.set(p.id,p));
        return Array.from(map.values());
      });
    } catch {}
  }, 300);

  function onSearchChange(idx, value){
    debouncedSearch(value, idx);
  }

  function openModal(idx){ setActiveLine(idx); setShowModal(true); }
  function closeModal(){ setShowModal(false); setActiveLine(null); }

  async function handleCreateProduct(e){
    e.preventDefault();
    if(creating) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      sku: fd.get('sku'),
      name: fd.get('name'),
      description: fd.get('description') || undefined,
      unit: fd.get('unit') || undefined
    };
    if(!payload.sku || !payload.name){ pushToast('SKU & Nom requis','error'); return; }
    setCreating(true);
    try {
      const res = await authorizedFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if(!res.ok){ pushToast(data.error || 'Erreur création produit','error'); return; }
      // Insert new product
      setProducts(ps => [{ id: data.id, name: data.name, sku: data.sku, unit: data.unit }, ...ps]);
      if(activeLine != null){
        updateLine(activeLine, { productId: data.id });
      }
      pushToast('Produit créé','success');
      closeModal();
      e.currentTarget.reset();
    } catch { pushToast('Erreur réseau','error'); } finally { setCreating(false); }
  }

  async function handleSubmit(e){
    e.preventDefault();
    if(submitting) return;
    const supplierId = e.currentTarget.supplierId.value;
    if(!supplierId){ pushToast('Fournisseur requis','error'); return; }
    // Build payload lines excluding empty ones
    const useLines = lines.filter(l => l.productId || l.orderedQty || l.unitPrice || l.vatRate || l.assetCategoryId).filter(l => l.productId);
    if(!useLines.length){ pushToast('Ajouter au moins une ligne','error'); return; }
    // Validate numeric
    for(const l of useLines){
      const q = parseFloat(String(l.orderedQty).replace(',','.'));
      const up = parseFloat(String(l.unitPrice).replace(',','.'));
      if(!(q>0)){ pushToast('Quantité > 0 requise','error'); return; }
      if(!(up>=0)){ pushToast('PU >= 0 requis','error'); return; }
    }
    const normLines = useLines.map(l => ({
      productId: l.productId,
      orderedQty: String(parseFloat(l.orderedQty)),
      unitPrice: String(parseFloat(l.unitPrice)),
      vatRate: l.vatRate ? Number(l.vatRate).toFixed(2) : undefined,
      assetCategoryId: l.assetCategoryId || undefined
    }));
    const payload = {
      supplierId,
      expectedDate: e.currentTarget.expectedDate.value || undefined,
      currency: e.currentTarget.currency.value || 'EUR',
      notes: e.currentTarget.notes.value || undefined,
      lines: normLines
    };
    setSubmitting(true);
    try {
      const resp = await authorizedFetch('/api/purchase-orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await resp.json();
      if(!resp.ok){ pushToast(data.error || 'Erreur création PO','error'); return; }
      pushToast('Bon de commande créé','success');
      if(data?.id) window.location.href = '/purchase-orders/' + data.id;
    } catch { pushToast('Erreur réseau','error'); } finally { setSubmitting(false); }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-xs space-y-1">
            <span className="font-medium">Fournisseur</span>
            <select name="supplierId" className="border px-2 py-1 rounded text-sm" ref={supplierRef} required>
              <option value="">Choisir…</option>
              {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1">
            <span className="font-medium">Date attendue</span>
            <input type="date" name="expectedDate" className="border px-2 py-1 rounded text-sm" />
          </label>
          <label className="text-xs space-y-1">
            <span className="font-medium">Devise</span>
            <input type="text" name="currency" defaultValue="EUR" className="border px-2 py-1 rounded text-sm" />
          </label>
        </div>
        <label className="text-xs space-y-1 block">
          <span className="font-medium">Notes</span>
          <textarea name="notes" rows={2} className="border w-full rounded px-2 py-1 text-sm" />
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm">Lignes</h2>
            <div className="flex gap-2">
              <button type="button" onClick={()=>addLine()} className="px-3 py-1 bg-blue-600 text-white text-xs rounded">Ajouter ligne</button>
              <button type="button" onClick={()=> refreshProducts()} className="px-3 py-1 bg-slate-500 text-white text-xs rounded" title="Rafraîchir produits">↻</button>
              <button type="button" onClick={()=> openModal(lines.length-1)} className="px-3 py-1 bg-emerald-600 text-white text-xs rounded">Nouveau produit</button>
            </div>
          </div>
          <div className="space-y-2">
            {lines.map((l,idx)=> {
              const used = lines.filter((o,i)=> i!==idx).map(o=>o.productId).filter(Boolean);
              return (
                <div key={idx} className="grid grid-cols-7 gap-2 items-start border p-2 rounded" data-line-row>
                  <div className="space-y-1 col-span-2">
                    <select value={l.productId} onChange={e=> handleProductChange(idx, e.target.value)} className="border px-2 py-1 rounded text-xs w-full">
                      <option value="">Produit…</option>
                      {products.map(p => <option key={p.id} value={p.id} disabled={used.includes(p.id)}>{p.name}{used.includes(p.id)?' (déjà utilisé)':''}</option>)}
                    </select>
                    <input value={l._search||''} onChange={e=> { updateLine(idx,{ _search:e.target.value }); onSearchChange(idx,e.target.value); }} placeholder="Rechercher…" className="border px-2 py-1 rounded text-[10px] w-full" />
                  </div>
                  <input value={l.orderedQty} onChange={e=> updateLine(idx,{ orderedQty:e.target.value })} type="number" step="0.001" placeholder="Qté" className="border px-2 py-1 rounded text-xs" />
                  <input value={l.unitPrice} onChange={e=> updateLine(idx,{ unitPrice:e.target.value })} type="number" step="0.0001" placeholder="PU" className="border px-2 py-1 rounded text-xs" />
                  <input value={l.vatRate} onChange={e=> updateLine(idx,{ vatRate:e.target.value })} type="number" step="0.01" placeholder="TVA" className="border px-2 py-1 rounded text-xs" />
                  <select value={l.assetCategoryId} onChange={e=> updateLine(idx,{ assetCategoryId:e.target.value })} className="border px-2 py-1 rounded text-xs">
                    <option value="">Caté immobilisation</option>
                    {assetCategories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                  </select>
                  <div className="flex flex-col items-end gap-1">
                    <button type="button" onClick={()=> removeLine(idx)} className="text-xs text-red-600">Supprimer</button>
                    {idx === lines.length-1 && <button type="button" onClick={()=> openModal(idx)} className="text-[10px] text-emerald-700 underline">+ produit</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-500">Remplir au moins une ligne (quantité & prix requis).</div>
        </div>
        <div className="flex gap-2">
          <button disabled={submitting} type="submit" className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-60">{submitting?'Création…':'Créer'}</button>
          <a href="/purchase-orders" className="px-4 py-2 bg-gray-300 rounded text-sm">Annuler</a>
        </div>
      </form>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-xs px-3 py-2 rounded shadow text-white ${toast.type==='error'?'bg-red-600':toast.type==='success'?'bg-emerald-600':'bg-slate-700'}`}>{toast.msg}</div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-6 overflow-auto" onClick={(e)=> { if(e.target===e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded shadow-lg w-full max-w-md p-4 space-y-4 relative">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Nouveau produit</h3>
              <button type="button" onClick={closeModal} className="text-xs text-gray-500 hover:text-black">✕</button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] space-y-1 col-span-1">
                  <span className="font-medium">SKU *</span>
                  <input name="sku" required className="border px-2 py-1 rounded text-xs w-full" />
                </label>
                <label className="text-[11px] space-y-1 col-span-1">
                  <span className="font-medium">Nom *</span>
                  <input name="name" required className="border px-2 py-1 rounded text-xs w-full" />
                </label>
              </div>
              <label className="text-[11px] space-y-1 block">
                <span className="font-medium">Description</span>
                <textarea name="description" rows={2} className="border px-2 py-1 rounded text-xs w-full" />
              </label>
              <label className="text-[11px] space-y-1 block">
                <span className="font-medium">Unité</span>
                <input name="unit" placeholder="PCS" className="border px-2 py-1 rounded text-xs w-full" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" disabled={creating} onClick={closeModal} className="px-3 py-1 text-xs bg-gray-200 rounded">Annuler</button>
                <button type="submit" disabled={creating} className="px-4 py-1 text-xs bg-emerald-600 text-white rounded disabled:opacity-60">{creating?'Création…':'Créer'}</button>
              </div>
              <p className="text-[10px] text-gray-500">Les champs marqués * sont obligatoires.</p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
