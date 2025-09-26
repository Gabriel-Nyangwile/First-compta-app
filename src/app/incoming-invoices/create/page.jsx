"use client";
import { useEffect, useState } from 'react';
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
  const [form, setForm] = useState({ supplierId: '', supplierInvoiceNumber: '', receiptDate: '', issueDate: '', dueDate: '', vat: '0.2' });
  const [lines, setLines] = useState([newEmptyLine()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(()=>{
    fetch('/api/suppliers').then(r=>r.json()).then(d=> setSuppliers(d.suppliers || []));
  },[]);

  const updateLine = (idx, patch) => {
    setLines(ls => ls.map((l,i)=> i===idx ? { ...l, ...patch } : l));
  };
  const addLine = () => setLines(ls => [...ls, newEmptyLine()]);
  const removeLine = (idx) => setLines(ls => ls.filter((_,i)=>i!==idx));

  const totalHt = lines.reduce((sum,l)=> sum + (Number(l.quantity||0)*Number(l.unitPrice||0)), 0);
  const vatAmount = totalHt * Number(form.vat || 0);
  const totalTtc = totalHt + vatAmount;

  const submit = async(e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (!form.supplierId) { setError('Fournisseur requis'); return; }
    if (!form.supplierInvoiceNumber.trim()) { setError('Numéro facture fournisseur requis'); return; }
    if (!lines.length || lines.some(l => !l.accountId)) { setError('Chaque ligne doit avoir un compte'); return; }
    setLoading(true);
    try {
      const payload = { ...form, lines };
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
            <button type="button" onClick={addLine} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">+ Ligne</button>
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
                        <input value={l.description} onChange={e=>updateLine(idx,{description:e.target.value})} className="border rounded px-2 py-1 w-full" />
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
                        <input value={l.unitOfMeasure} onChange={e=>updateLine(idx,{unitOfMeasure:e.target.value})} className="border rounded px-2 py-1 w-full" />
                      </td>
                      <td className="px-2 py-1 w-20">
                        <input type="number" value={l.quantity} onChange={e=>updateLine(idx,{quantity:e.target.value})} className="border rounded px-2 py-1 w-full" />
                      </td>
                      <td className="px-2 py-1 w-24">
                        <input type="number" value={l.unitPrice} onChange={e=>updateLine(idx,{unitPrice:e.target.value})} className="border rounded px-2 py-1 w-full" />
                      </td>
                      <td className="px-2 py-1 text-right font-mono"><Amount value={lineTotal} /></td>
                      <td className="px-2 py-1 text-center">
                        {lines.length > 1 && <button type="button" onClick={()=>removeLine(idx)} className="text-red-600 hover:underline">X</button>}
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
