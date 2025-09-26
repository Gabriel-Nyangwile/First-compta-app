// app/clients/create/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AccountAutocomplete from '@/components/AccountAutocomplete';

export default function CreateClientPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', address: '', category: 'DAYS_30' });
  const [linkAccount, setLinkAccount] = useState(false);
  const [account, setAccount] = useState(null); // {id, number, label}
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Protection basique: reset compte si on décoche
  useEffect(() => {
    if (!linkAccount) setAccount(null);
  }, [linkAccount]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Nom requis');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          accountId: account?.id || undefined,
          category: form.category,
        })
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch (parseErr) {
        setError('Réponse serveur invalide.');
        return;
      }
      if (!res.ok) {
        setError(payload.error || 'Erreur lors de la création');
        return;
      }
      setSuccess(true);
      // Redirect après petit délai pour feedback
      setTimeout(() => router.push('/clients'), 600);
    } catch (err) {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Ajouter un Client</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={linkAccount}
                onChange={e => setLinkAccount(e.target.checked)}
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
                onChange={(acc) => setAccount(acc)}
                maxLength={20}
              />
              <p className="mt-1 text-xs text-gray-500">Si le compte n'existe pas, créez-le via l'autocomplete.</p>
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
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
            disabled={submitting}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-60"
          >
            {submitting ? 'Enregistrement...' : 'Ajouter le client'}
          </button>
          {error && <p className="mt-2 text-center text-red-600 text-sm font-medium">{error}</p>}
          {success && !error && <p className="mt-2 text-center text-green-600 text-sm font-medium">Client créé, redirection...</p>}
        </form>
      </div>
    </main>
  );
}