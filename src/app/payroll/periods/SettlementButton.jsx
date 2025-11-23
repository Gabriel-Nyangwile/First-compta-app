"use client";
import { useState } from 'react';

export default function SettlementButton({ periodId, periodRef }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function settle() {
    if (!periodId) return;
    setLoading(true); setMessage('');
    try {
      const res = await fetch('/api/payroll/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json.error || 'Règlement échoué');
      setMessage(`OK ${json.journalNumber || ''} (${(json.debit ?? '').toString()}/${(json.credit ?? '').toString()})`);
    } catch (e) {
      setMessage(e.message || 'Erreur règlement');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={settle} disabled={loading} className="px-2 py-1 rounded bg-emerald-700 text-white text-xs disabled:opacity-50">
        {loading ? 'Paiement...' : 'Régler net'}
      </button>
      {message && <span className="text-xs text-gray-700">{message}</span>}
    </div>
  );
}
