"use client";
import { useState } from 'react';

export default function PayButton({ periodId, employeeId, disabled }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(null);

  async function pay() {
    if (!periodId || !employeeId) return;
    setLoading(true); setMessage(''); setOk(null);
    try {
      const res = await fetch('/api/payroll/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId, employeeId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json.error || 'Paiement échoué');
      setOk(true);
      setMessage(`OK ${json.journalNumber || ''}`);
    } catch (e) {
      setOk(false);
      setMessage(e.message || 'Erreur paiement');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={pay} disabled={loading || disabled} className="px-2 py-1 rounded bg-emerald-700 text-white text-xs disabled:opacity-50">
        {loading ? 'Paiement...' : 'Régler ce bulletin'}
      </button>
      {message && <span className={`text-xs ${ok === null ? 'text-gray-700' : ok ? 'text-green-700' : 'text-amber-700'}`}>{message}</span>}
    </div>
  );
}
