"use client";
import { useEffect, useState } from 'react';
import Amount from '@/components/Amount';
import { useRouter, useParams } from 'next/navigation';
import AccountAutocomplete from '@/components/AccountAutocomplete';
import ClientNameAutocomplete from '@/components/ClientNameAutocomplete';

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [invoice,setInvoice] = useState(null);
  const [clientId,setClientId] = useState('');
  const [vat,setVat] = useState(0.2);
  const [issueDate,setIssueDate] = useState('');
  const [dueDate,setDueDate] = useState('');
  const [lines,setLines] = useState([]);

  useEffect(()=> {
    if(!id) return;
    setLoading(true);
    fetch(`/api/invoices/${id}`)
      .then(r=>r.json())
      .then(d=>{
        if(d.error) { setError(d.error); return; }
        setInvoice(d);
        setClientId(d.clientId || '');
        setVat(Number(d.vat));
        setIssueDate(d.issueDate ? d.issueDate.substring(0,10) : '');
        setDueDate(d.dueDate ? d.dueDate.substring(0,10) : '');
        setLines(d.invoiceLines.map(l=> ({
          description: l.description,
          accountId: l.accountId,
          unitOfMeasure: l.unitOfMeasure,
          quantity: String(l.quantity),
            unitPrice: String(l.unitPrice)
        })));
      })
      .catch(()=>setError('Erreur chargement'))
      .finally(()=>setLoading(false));
  },[id]);

  const totalHt = lines.reduce((s,l)=> s + (Number(l.quantity)||0)*(Number(l.unitPrice)||0),0);
  const vatAmount = totalHt * Number(vat||0);
  const totalTtc = totalHt + vatAmount;

  const updateLine = (idx,patch) => setLines(ls => ls.map((l,i)=> i===idx ? { ...l, ...patch } : l));
  const addLine = () => setLines(ls => [...ls, { description:'', accountId:'', unitOfMeasure:'u', quantity:'1', unitPrice:'0' }]);
  const removeLine = (idx) => setLines(ls => ls.filter((_,i)=>i!==idx));

  const save = async(e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ clientId, issueDate, dueDate, vat, invoiceLines: lines }) });
      const data = await res.json();
      if(!res.ok) { setError(data.error||'Erreur sauvegarde'); }
      else { router.push(`/invoices/${id}`); }
    } catch { setError('Erreur réseau'); } finally { setSaving(false); }
  };

  if(loading) return <div className='pt-24 px-6'>Chargement...</div>;
  if(error) return <div className='pt-24 px-6 text-red-600 text-sm'>{error}</div>;
  if(!invoice) return null;

  return (
    <main className='min-h-screen pt-24 px-6 bg-gray-50'>
      <div className='max-w-3xl mx-auto bg-white border rounded shadow p-6 flex flex-col gap-6'>
        <h1 className='text-xl font-semibold'>Modifier facture {invoice.invoiceNumber}</h1>
        <form onSubmit={save} className='flex flex-col gap-6 text-sm'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <label className='block mb-1'>Client</label>
              <ClientNameAutocomplete value={invoice.client ? invoice.client : null} onChange={c=> setClientId(c?.id||'')} />
            </div>
            <div>
              <label className='block mb-1'>Date émission</label>
              <input type='date' value={issueDate} onChange={e=>setIssueDate(e.target.value)} className='w-full border rounded px-3 py-2' />
            </div>
            <div>
              <label className='block mb-1'>Date échéance</label>
              <input type='date' value={dueDate} onChange={e=>setDueDate(e.target.value)} className='w-full border rounded px-3 py-2' />
            </div>
            <div>
              <label className='block mb-1'>TVA (%)</label>
              <input type='number' step='0.01' value={vat} onChange={e=>setVat(e.target.value)} className='w-full border rounded px-3 py-2' />
            </div>
          </div>

          <div className='flex items-center justify-between'>
            <h2 className='font-semibold'>Lignes</h2>
            <button type='button' onClick={addLine} className='text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded'>+ Ligne</button>
          </div>
          <div className='overflow-auto border rounded'>
            <table className='min-w-full text-xs'>
              <thead className='bg-gray-100'>
                <tr>
                  <th className='px-2 py-1 text-left'>Description</th>
                  <th className='px-2 py-1 text-left'>Compte</th>
                  <th className='px-2 py-1 text-left'>Unité</th>
                  <th className='px-2 py-1 text-left'>Qté</th>
                  <th className='px-2 py-1 text-left'>PU</th>
                  <th className='px-2 py-1 text-left'>Total</th>
                  <th className='px-2 py-1'></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l,idx)=> {
                  const lineTotal = (Number(l.quantity)||0)*(Number(l.unitPrice)||0);
                  return (
                    <tr key={idx} className='border-t'>
                      <td className='px-2 py-1'><input value={l.description} onChange={e=>updateLine(idx,{description:e.target.value})} className='border rounded px-2 py-1 w-full' /></td>
                      <td className='px-2 py-1 min-w-[180px]'>
                        <AccountAutocomplete value={l._account || null} onChange={acc=> updateLine(idx,{ accountId:acc?acc.id:'', _account:acc||null })} />
                      </td>
                      <td className='px-2 py-1'><input value={l.unitOfMeasure} onChange={e=>updateLine(idx,{unitOfMeasure:e.target.value})} className='border rounded px-2 py-1 w-full' /></td>
                      <td className='px-2 py-1 w-20'><input type='number' value={l.quantity} onChange={e=>updateLine(idx,{quantity:e.target.value})} className='border rounded px-2 py-1 w-full' /></td>
                      <td className='px-2 py-1 w-24'><input type='number' value={l.unitPrice} onChange={e=>updateLine(idx,{unitPrice:e.target.value})} className='border rounded px-2 py-1 w-full' /></td>
                      <td className='px-2 py-1 text-right font-mono'><Amount value={lineTotal} /></td>
                      <td className='px-2 py-1 text-center'>{lines.length>1 && <button type='button' onClick={()=>removeLine(idx)} className='text-red-600 hover:underline'>X</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className='flex flex-col gap-1 text-sm items-end'>
            <div>Total HT: <span className='font-semibold'><Amount value={totalHt} /></span></div>
            <div>TVA: <span className='font-semibold'><Amount value={vatAmount} /></span></div>
            <div>Total TTC: <span className='font-semibold'><Amount value={totalTtc} /></span></div>
          </div>
          {error && <div className='text-red-600 text-xs'>{error}</div>}
          <div className='flex gap-2'>
            <button disabled={saving} type='submit' className='bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2 rounded'>Enregistrer</button>
            <button type='button' onClick={()=>router.push(`/invoices/${id}`)} className='border px-5 py-2 rounded'>Annuler</button>
          </div>
        </form>
      </div>
    </main>
  );
}
