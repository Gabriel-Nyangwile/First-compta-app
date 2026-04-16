"use client";

import { useState } from 'react';

export default function PayrollLetteringButton({ periodId, liabilityCode = '', buttonLabel = 'Lettrer paie', onDone = null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(null);

  async function handleClick() {
    if (!periodId) return;
    setLoading(true);
    setMessage('');
    setOk(null);
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/lettering`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liabilityCode ? { liabilityCode } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json.error || 'Lettrage paie échoué');
      const result = json.result || null;
      const count = result?.updated ?? json.results?.reduce((sum, item) => sum + (item.updated || 0), 0) ?? 0;
      setOk(true);
      setMessage(`${count} écriture(s) synchronisée(s)`);
      if (typeof onDone === 'function') onDone(json);
    } catch (error) {
      setOk(false);
      setMessage(error.message || 'Erreur lettrage paie');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={handleClick} disabled={loading} className="px-2 py-1 rounded bg-slate-700 text-white text-xs disabled:opacity-50">
        {loading ? 'Lettrage…' : buttonLabel}
      </button>
      {message && <span className={`text-xs ${ok ? 'text-green-700' : 'text-amber-700'}`}>{message}</span>}
    </div>
  );
}