"use client";
import { useState } from 'react';

export default function ReverseButton({ periodId, hasJournal = true }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  async function onReverse() {
    if (!hasJournal) return;
    const ok = window.confirm('Confirmer l\'annulation de la paie (reversal) ?');
    if (!ok) return;
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/reverse`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur reverse');
      setMsg(`Annulée via ${json.journalNumber} (${json.reversedCount} lignes)`);
      setTimeout(()=>{ window.location.reload(); }, 900);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-1">
      <button onClick={onReverse} disabled={loading || !hasJournal} title={!hasJournal ? 'Aucun journal de paie trouvé' : ''} className="px-3 py-1 rounded bg-red-700 text-white text-sm disabled:opacity-50">
        {loading ? 'Annulation…' : 'Reverser (Annuler)'}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
