"use client";
import { useState } from 'react';

export default function RecalcButton({ payslipId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(null);

  async function onClick() {
    setLoading(true);
    setMsg('');
    setOk(null);
    try {
      const res = await fetch(`/api/payroll/payslips/${payslipId}/recalculate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur recalc');
      setMsg(`Recalculé: Brut ${json.gross} Net ${json.net}`);
      setOk(true);
      setTimeout(() => { window.location.reload(); }, 600);
    } catch (e) {
      setOk(false);
      setMsg(e.message || 'Erreur recalcul');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1 relative">
      <button onClick={onClick} disabled={loading} className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50">
        {loading ? 'Recalcul.' : 'Recalculer'}
      </button>
      {msg && (
        <div className={`text-xs px-2 py-1 rounded shadow absolute top-9 left-0 ${ok === null ? 'bg-gray-100 text-gray-700' : ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {msg}
        </div>
      )}
    </div>
  );
}
