"use client";
import { useState } from 'react';

export default function RecalcButton({ payslipId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  async function onClick() {
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`/api/payroll/payslips/${payslipId}/recalculate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur recalc');
      setMsg(`Recalculé: Brut ${json.gross} Net ${json.net}`);
      setTimeout(() => { window.location.reload(); }, 600);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-1">
      <button onClick={onClick} disabled={loading} className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50">
        {loading ? 'Recalcul…' : 'Recalculer'}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}