"use client";

import { useState } from 'react';

export default function RepairStatusButton({ periodId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function onRepair() {
    const ok = window.confirm("Confirmer la remise en LOCKED de cette période POSTED sans journal ?");
    if (!ok) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/repair-status`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur réparation');
      setMsg(`Période remise en ${json.newStatus}`);
      setTimeout(() => { window.location.reload(); }, 800);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onRepair}
        disabled={loading}
        className="px-3 py-1 rounded bg-amber-700 text-white text-sm disabled:opacity-50"
      >
        {loading ? 'Réparation…' : 'Réparer le statut'}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
