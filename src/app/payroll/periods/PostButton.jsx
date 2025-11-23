"use client";
import { useState } from 'react';

export default function PostButton({ periodId }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  async function onPost() {
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/post`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur posting');
      setMsg(`Journal ${json.journalNumber} créé (${json.transactions} lignes)`);
      setTimeout(()=>{ window.location.reload(); }, 900);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-1">
      <button onClick={onPost} disabled={loading} className="px-3 py-1 rounded bg-green-700 text-white text-sm disabled:opacity-50">
        {loading ? 'Publication…' : 'Publier (Journal)'}
      </button>
      {msg && <div className="text-xs text-gray-600">{msg}</div>}
    </div>
  );
}
