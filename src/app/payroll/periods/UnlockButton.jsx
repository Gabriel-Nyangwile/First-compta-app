"use client";

import { useState } from 'react';

export default function UnlockButton({ periodId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function onUnlock() {
    const ok = window.confirm('Déverrouiller cette période pour correction ?');
    if (!ok) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/unlock`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Déverrouillage impossible');
      setMsg('Période rouverte');
      setTimeout(() => { window.location.reload(); }, 700);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button onClick={onUnlock} disabled={loading} className="px-3 py-1 rounded bg-gray-700 text-white text-sm disabled:opacity-50">
        {loading ? 'Réouverture…' : 'Déverrouiller'}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
