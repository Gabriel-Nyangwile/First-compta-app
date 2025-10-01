'use client';
import { useState } from 'react';

export default function DownloadIncomingInvoicePDFButton({ incomingInvoiceId, className = '', label = 'PDF' }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    if (!incomingInvoiceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/incoming-invoices/${incomingInvoiceId}/pdf`, { method: 'GET' });
      if (!res.ok) throw new Error('Erreur génération PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incoming-invoice-${incomingInvoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || 'Erreur téléchargement PDF');
    } finally {
      setLoading(false);
    }
  }
  return (
    <button type="button" onClick={handleClick} disabled={loading} className={`px-3 py-2 rounded text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white ${className}`}>
      {loading ? 'Génération...' : label}
    </button>
  );
}
