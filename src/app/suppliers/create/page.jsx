"use client";
import { useState } from 'react';
import dynamic from 'next/dynamic';
const AccountAutocomplete = dynamic(()=> import('@/components/AccountAutocomplete'), { ssr: false });
import { useRouter } from 'next/navigation';

export default function CreateSupplierPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', accountId: '' });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async(e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (!form.name.trim()) { setError('Nom requis'); return; }
    setLoading(true);
    try {
  const payload = { ...form };
  if (selectedAccount?.id) payload.accountId = selectedAccount.id; else delete payload.accountId;
  const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); }
      else {
        setSuccess(true);
        setTimeout(()=> router.push('/suppliers'), 800);
      }
    } catch {
      setError('Erreur réseau');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-xl mx-auto bg-white border rounded shadow p-6 flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Nouveau fournisseur</h1>
        <form onSubmit={submit} className="flex flex-col gap-4 text-sm">
          <div>
            <label className="block mb-1">Nom *</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block mb-1">Email</label>
            <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block mb-1">Téléphone</label>
            <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block mb-1">Adresse</label>
            <textarea value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="w-full border rounded px-3 py-2" rows={3} />
          </div>
          <div>
            <label className="block mb-1">Compte fournisseur (401...)</label>
            <AccountAutocomplete
              value={selectedAccount}
              onChange={(acc)=> setSelectedAccount(acc)}
              maxLength={12}
              filterPrefix="401"
            />
            <p className="mt-1 text-[11px] text-gray-500">Optionnel : laisse vide si le compte 401 n'est pas encore créé.</p>
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          {success && <div className="text-green-600 text-xs">Créé ✔</div>}
          <div className="flex gap-2">
            <button disabled={loading} type="submit" className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded">Enregistrer</button>
            <button type="button" onClick={()=>router.back()} className="border px-4 py-2 rounded">Annuler</button>
          </div>
        </form>
      </div>
    </main>
  );
}
