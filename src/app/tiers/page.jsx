"use client";
import { useEffect, useState } from 'react';
import Amount from '@/components/Amount';
import Link from 'next/link';

export default function TiersPage() {
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=> {
    Promise.all([
      fetch('/api/clients').then(r=>r.json()).catch(()=>({error:'clients'})),
      fetch('/api/suppliers').then(r=>r.json()).catch(()=>({error:'suppliers'}))
    ]).then(([c,s])=>{
      if (c.error || s.error) setError('Erreur chargement données');
      setClients(c.clients || []);
      setSuppliers(s.suppliers || []);
    }).finally(()=> setLoading(false));
  },[]);

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Tiers</h1>
          <Link href="/clients/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">Nouveau client</Link>
          <Link href="/suppliers/create" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm">Nouveau fournisseur</Link>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {loading && <div>Chargement…</div>}
        {!loading && (
          <div className="grid md:grid-cols-2 gap-8">
            <section className="bg-white border rounded shadow p-4 flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="font-semibold">Clients</h2>
                <Link href="/clients" className="text-xs text-blue-600 hover:underline">Voir tout</Link>
              </header>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Nom</th>
                    <th className="px-2 py-1 text-left">Email</th>
                    <th className="px-2 py-1 text-left">Compte</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0,8).map(c=> (
                    <tr key={c.id} className="border-t">
                      <td className="px-2 py-1">{c.name}</td>
                      <td className="px-2 py-1">{c.email || '-'}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{c.account?.number || '-'}</td>
                    </tr>
                  ))}
                  {!clients.length && <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-400">Aucun client</td></tr>}
                </tbody>
              </table>
            </section>
            <section className="bg-white border rounded shadow p-4 flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="font-semibold">Fournisseurs</h2>
                <Link href="/suppliers" className="text-xs text-blue-600 hover:underline">Voir tout</Link>
              </header>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Nom</th>
                    <th className="px-2 py-1 text-left">Compte</th>
                    <th className="px-2 py-1 text-right">Factures</th>
                    <th className="px-2 py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.slice(0,8).map(s=> (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-1">{s.name}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{s.account?.number || '-'}</td>
                      <td className="px-2 py-1 text-right">{s.incomingInvoicesCount || 0}</td>
                      <td className="px-2 py-1 text-right font-mono"><Amount value={Number(s.incomingInvoicesTotal||0)} /></td>
                    </tr>
                  ))}
                  {!suppliers.length && <tr><td colSpan={4} className="px-2 py-4 text-center text-gray-400">Aucun fournisseur</td></tr>}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
