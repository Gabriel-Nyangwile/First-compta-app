// src/app/clients/edit/[id]/page.jsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AccountAutocomplete from '@/components/AccountAutocomplete';

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkAccount, setLinkAccount] = useState(false);
  const [account, setAccount] = useState(null); // {id, number, label}
  const [form, setForm] = useState({ name: '', email: '', address: '', category: 'DAYS_30' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}`);
        if (!res.ok) {
          setError('Client introuvable');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setForm({
          name: data.name || '',
          email: data.email || '',
          address: data.address || '',
          category: data.category || 'DAYS_30'
        });
        if (data.account) {
          setAccount({ id: data.account.id, number: data.account.number, label: data.account.label });
          setLinkAccount(true);
        }
      } catch (e) {
        setError('Erreur chargement client');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Nom requis'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          category: form.category,
          accountId: linkAccount ? account?.id : null,
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error || 'Erreur sauvegarde');
        return;
      }
      router.push('/clients');
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error && !saving && !form.name) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Éditer le Client</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={linkAccount}
                onChange={e => {
                  const checked = e.target.checked;
                  setLinkAccount(checked);
                  if (!checked) setAccount(null);
                }}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">Associer un compte comptable</span>
            </label>
          </div>
          {linkAccount && (
            <div>
              <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 mb-1">Numéro de compte</label>
              <AccountAutocomplete
                value={account}
                onChange={setAccount}
                maxLength={20}
              />
              <p className="mt-1 text-xs text-gray-500">Créer ou sélectionner un compte.</p>
            </div>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="Nom du client"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email (optionnel)</label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={form.address}
              onChange={handleChange}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out resize-y"
              placeholder="Adresse du client"
            />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Catégorie de paiement</label>
            <select
              id="category"
              name="category"
              required
              value={form.category}
              onChange={handleChange}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out bg-white"
            >
              <option value="CASH">Comptant (0 jour)</option>
              <option value="DAYS_15">15 jours</option>
              <option value="DAYS_30">30 jours</option>
              <option value="DAYS_45">45 jours</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
          {error && <p className="mt-2 text-center text-red-600 text-sm font-medium">{error}</p>}
        </form>
      </div>
    </main>
  );
}
