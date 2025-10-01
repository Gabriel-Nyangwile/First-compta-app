"use client";
import { useEffect, useState, useCallback } from 'react';
import Amount from '@/components/Amount';
import dynamic from 'next/dynamic';
const AccountAutocomplete = dynamic(()=> import('@/components/AccountAutocomplete'), { ssr:false });
import { useRouter } from 'next/navigation';

function newEmptyLine() {
  return { description: '', accountId: '', unitOfMeasure: 'u', quantity: '1', unitPrice: '0' };
}

export default function CreateIncomingInvoicePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ supplierId: '', supplierInvoiceNumber: '', receiptDate: '', issueDate: '', dueDate: '', vat: '0.2', purchaseOrderId: '' });
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [lines, setLines] = useState([newEmptyLine()]);
  const [autoFromPO, setAutoFromPO] = useState(false); // si true => lignes auto issues du PO
  const [poLoading, setPoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(()=>{
    fetch('/api/suppliers').then(r=>r.json()).then(d=> setSuppliers(d.suppliers || []));
  },[]);

  // Charger bons de commande en fonction du fournisseur sélectionné
  useEffect(()=>{
    if(!form.supplierId){ setPurchaseOrders([]); setForm(f=>({...f,purchaseOrderId:''})); return; }
    fetch('/api/purchase-orders?supplierId='+encodeURIComponent(form.supplierId))
      .then(r=>r.json())
      .then(d=>{ if(Array.isArray(d)) setPurchaseOrders(d); })
      .catch(()=>{});
  }, [form.supplierId]);

  // Quand un PO est sélectionné, on va chercher ses lignes restantes et on pré-remplit
  useEffect(()=> {
    let abort = false;
    async function loadPOLines() {
      if (!form.purchaseOrderId) {
        setAutoFromPO(false);
        // reinitialise si on vient de désélectionner
        setLines([newEmptyLine()]);
        return;
      }
      setPoLoading(true);
      try {
        const res = await fetch(`/api/purchase-orders/${form.purchaseOrderId}`);
        if (!res.ok) throw new Error('PO introuvable');
        const po = await res.json();
        if (abort) return;
        // Utiliser toutes les lignes (ou uniquement celles reçues ? Demande: produits déjà réceptionnés => on suppose lignes dont receivedQty > 0)
        const usable = (po.lines || []).filter(l => Number(l.receivedQty) > 0); // produits déjà réceptionnés
        // fallback si aucune receivedQty>0 => on prend quand même l'ensemble des lignes
        const base = usable.length ? usable : (po.lines || []);
        const mapped = base.map(l => ({
          description: l.product?.name || l.product?.sku || 'Produit',
          accountId: '', // restera à calculer si on veut un mapping produit->compte; laisser vide = utilisateur choisira éventuellement après
          unitOfMeasure: l.product?.unit || 'u',
            // Si on facture la quantité déjà reçue: prendre receivedQty, sinon orderedQty
          quantity: String(usable.length ? l.receivedQty : l.orderedQty),
          unitPrice: String(l.unitPrice),
          _locked: true
        }));
        setLines(mapped.length ? mapped : [newEmptyLine()]);
        setAutoFromPO(true);
      } catch (e) {
        console.warn('Chargement PO échoué', e);
        setAutoFromPO(false);
      } finally { if (!abort) setPoLoading(false); }
    }
    loadPOLines();
    return () => { abort = true; };
  }, [form.purchaseOrderId]);

  // Permettre forçage recalcul si besoin (ex: bouton refresh futur)
  const forceReloadPO = useCallback(()=>{
    if (form.purchaseOrderId) {
      setForm(f=>({ ...f })); // retrig l'effet (pas élégant mais suffisant)
    }
  }, [form.purchaseOrderId]);

  const updateLine = (idx, patch) => {
    setLines(ls => ls.map((l,i)=> i===idx ? { ...l, ...patch } : l));
  };
  const addLine = () => {
    if (autoFromPO) return; // pas d'ajout manuel en mode PO
    setLines(ls => [...ls, newEmptyLine()]);
  };
  const removeLine = (idx) => setLines(ls => ls.filter((_,i)=>i!==idx));

  const totalHt = lines.reduce((sum,l)=> sum + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0);
  const vatAmount = totalHt * Number(form.vat || 0);
  const totalTtc = totalHt + vatAmount;

  const submit = async(e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (!form.supplierId) { setError('Fournisseur requis'); return; }
    if (!form.supplierInvoiceNumber.trim()) { setError('Numéro facture fournisseur requis'); return; }
    if (!lines.length) { setError('Au moins une ligne nécessaire'); return; }
    if (lines.some(l => !l.accountId)) { setError('Chaque ligne doit avoir un compte'); return; }
    setLoading(true);
    try {
  const payload = { ...form, lines, purchaseOrderId: form.purchaseOrderId || undefined };
      const res = await fetch('/api/incoming-invoices', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Erreur'); else {
        setSuccess(true);
        setTimeout(()=> router.push('/incoming-invoices'), 900);
      }
    } catch {
      setError('Erreur réseau');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white border rounded shadow p-6 flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Nouvelle facture fournisseur reçue</h1>
        <form onSubmit={submit} className="flex flex-col gap-6 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1">Fournisseur *</label>
              <select value={form.supplierId} onChange={e=>setForm(f=>({...f,supplierId:e.target.value}))} className="w-full border rounded px-3 py-2">
                <option value="">--</option>
                {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1">Bon de commande (optionnel)</label>
              <select value={form.purchaseOrderId} onChange={e=>setForm(f=>({...f,purchaseOrderId:e.target.value}))} className="w-full border rounded px-3 py-2 disabled:opacity-50" disabled={!purchaseOrders.length}>
                <option value="">-- Aucun --</option>
                {purchaseOrders.map(po=> <option key={po.id} value={po.id}>{po.number} ({po.status})</option>)}
              </select>
              {poLoading && <div className="text-xs text-gray-500 mt-1">Chargement lignes du BC...</div>}
              {autoFromPO && !poLoading && <div className="text-[11px] text-blue-600 mt-1 flex items-center gap-2">Lignes auto remplies depuis le BC. <button type="button" onClick={()=> { setForm(f=>({...f,purchaseOrderId:''})); }} className="underline">Détacher</button><button type="button" onClick={forceReloadPO} className="underline">↻</button></div>}
            </div>
            <div>
              <label className="block mb-1">Numéro facture fournisseur *</label>
              <input value={form.supplierInvoiceNumber} onChange={e=>setForm(f=>({...f,supplierInvoiceNumber:e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block mb-1">Taux TVA</label>
              <input type="number" step="0.01" value={form.vat} onChange={e=>setForm(f=>({...f,vat:e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block mb-1">Date réception</label>
              <input type="date" value={form.receiptDate} onChange={e=>setForm(f=>({...f,receiptDate:e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block mb-1">Date émission</label>
              <input type="date" value={form.issueDate} onChange={e=>setForm(f=>({...f,issueDate:e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block mb-1">Date échéance</label>
              <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Lignes</h2>
            <button type="button" onClick={addLine} disabled={autoFromPO} className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-1 rounded">+ Ligne</button>
          </div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left">Description</th>
                  <th className="px-2 py-1 text-left">Compte (6xx)</th>
                  <th className="px-2 py-1 text-left">Unité</th>
                  <th className="px-2 py-1 text-left">Qté</th>
                  <th className="px-2 py-1 text-left">PU</th>
                  <th className="px-2 py-1 text-left">Total</th>
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l,idx)=> {
                  const lineTotal = Number(l.quantity||0)*Number(l.unitPrice||0);
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">
                        <input value={l.description} onChange={e=>updateLine(idx,{description:e.target.value})} className="border rounded px-2 py-1 w-full disabled:opacity-70" disabled={l._locked} />
                      </td>
                      <td className="px-2 py-1 min-w-[180px]">
                        <AccountAutocomplete
                          value={l._account || null}
                          onChange={(acc)=> {
                            updateLine(idx,{ accountId: acc ? acc.id : '', _account: acc || null });
                          }}
                          maxLength={8}
                          filterPrefix="6"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input value={l.unitOfMeasure} onChange={e=>updateLine(idx,{unitOfMeasure:e.target.value})} className="border rounded px-2 py-1 w-full disabled:opacity-70" disabled={l._locked} />
                      </td>
                      <td className="px-2 py-1 w-20">
                        <input type="number" value={l.quantity} onChange={e=>updateLine(idx,{quantity:e.target.value})} className="border rounded px-2 py-1 w-full disabled:opacity-70" disabled={l._locked} />
                      </td>
                      <td className="px-2 py-1 w-24">
                        <input type="number" value={l.unitPrice} onChange={e=>updateLine(idx,{unitPrice:e.target.value})} className="border rounded px-2 py-1 w-full disabled:opacity-70" disabled={l._locked} />
                      </td>
                      <td className="px-2 py-1 text-right font-mono"><Amount value={lineTotal} /></td>
                      <td className="px-2 py-1 text-center">
                        {(!l._locked && lines.length > 1) && <button type="button" onClick={()=>removeLine(idx)} className="text-red-600 hover:underline">X</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 text-sm items-end">
            <div>Total HT: <span className="font-semibold"><Amount value={totalHt} /></span></div>
            <div>TVA: <span className="font-semibold"><Amount value={vatAmount} /></span></div>
            <div>Total TTC: <span className="font-semibold"><Amount value={totalTtc} /></span></div>
          </div>

          {error && <div className="text-red-600 text-xs">{error}</div>}
          {success && <div className="text-green-600 text-xs">Facture créée ✔</div>}

          <div className="flex gap-2">
            <button disabled={loading} type="submit" className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2 rounded">Enregistrer</button>
            <button type="button" onClick={()=>router.back()} className="border px-5 py-2 rounded">Annuler</button>
          </div>
        </form>
      </div>
    </main>
  );
}
