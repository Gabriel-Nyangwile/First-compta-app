"use client";
import { useState } from 'react';

export default function LockButton({ periodId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  async function onLock() {
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/lock`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur lock');
      setMsg(`Verrouillée (${json.payslipsLocked} bulletins)`);
      setTimeout(()=>{ window.location.reload(); }, 700);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-1">
      <button onClick={onLock} disabled={loading} className="px-3 py-1 rounded bg-amber-600 text-white text-sm disabled:opacity-50">
        {loading ? 'Verrouillage…' : 'Verrouiller période'}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}