"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteIncomingInvoiceButton({ id }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const onDelete = async () => {
    if (loading) return;
    setError('');
    if (!confirm('Supprimer définitivement cette facture fournisseur ?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/incoming-invoices/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || !data.ok) {
        setError(data.error || 'Suppression impossible');
      } else {
        router.push('/incoming-invoices');
      }
    } catch (e) {
      setError('Erreur réseau');
    } finally { setLoading(false); }
  };
  return (
    <div className="flex flex-col items-end">
      <button onClick={onDelete} disabled={loading} className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-sm">
        {loading ? 'Suppression...' : 'Supprimer'}
      </button>
      {error && <span className="text-[10px] text-red-600 mt-1 max-w-[160px] text-right">{error}</span>}
    </div>
  );
}
