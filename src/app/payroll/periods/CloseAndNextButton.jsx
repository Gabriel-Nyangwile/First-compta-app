"use client";

import { useState } from 'react';

export default function CloseAndNextButton({ periodId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [nextPeriod, setNextPeriod] = useState(null);

  async function onClose() {
    const ok = window.confirm('Clôturer cette période de paie et ouvrir la période suivante ?');
    if (!ok) return;
    setLoading(true);
    setMsg('');
    setNextPeriod(null);
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/close-and-next`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Clôture impossible');
      setNextPeriod(json.nextPeriod || null);
      setMsg(json.nextCreated ? `Période suivante créée: ${json.nextPeriod.ref}` : `Période suivante déjà ouverte: ${json.nextPeriod.ref}`);
      setTimeout(() => { window.location.reload(); }, 1200);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={onClose}
        disabled={loading}
        className="px-3 py-1 rounded bg-slate-900 text-white text-sm disabled:opacity-50"
      >
        {loading ? 'Clôture…' : 'Clôturer et ouvrir suivante'}
      </button>
      {msg && <div className="text-xs text-gray-600 max-w-md">{msg}</div>}
      {nextPeriod && (
        <a className="text-xs text-blue-700 underline" href={`/payroll/periods/${nextPeriod.ref}`}>
          Ouvrir {nextPeriod.ref}
        </a>
      )}
    </div>
  );
}
