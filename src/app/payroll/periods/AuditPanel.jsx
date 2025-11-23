"use client";
import { useEffect, useMemo, useState } from 'react';

export default function AuditPanel({ audit, periodId }) {
  const [onlyDiffs, setOnlyDiffs] = useState(false);
  const [data, setData] = useState(audit);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const tol = 0.01;

  useEffect(() => { setData(audit); }, [audit]);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter(r => !onlyDiffs || Math.abs(r.delta) > tol);
  }, [data, onlyDiffs]);

  async function onRefresh() {
    if (!periodId) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/payroll/period/${periodId}/audit`, { headers: { 'accept': 'application/json' } });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await res.text();
        throw new Error(`Réponse non-JSON (${res.status}) ${txt.slice(0,120)}`);
      }
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json.error || 'Audit échoué');
      setData(json);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function onDownload() {
    try {
      const payload = JSON.stringify(data, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ref = data?.periodRef || 'period';
      const jn = data?.journalNumber || 'journal';
      a.href = url;
      a.download = `audit-${ref}-${jn}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
      alert('Échec du téléchargement JSON');
    }
  }

  return (
    <section className="space-y-2 border rounded p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Réconciliation (Journal {data?.journalNumber})</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={onlyDiffs} onChange={(e)=>setOnlyDiffs(e.target.checked)} />
            N’afficher que les écarts
          </label>
          <button onClick={onRefresh} disabled={loading || !periodId} className="px-2 py-1 rounded bg-blue-700 text-white text-xs disabled:opacity-50">
            {loading ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>
          <button onClick={onDownload} className="px-2 py-1 rounded bg-gray-700 text-white text-xs">Télécharger JSON</button>
          <div className={(data?.balanced && data?.mismatchCount===0 ? 'text-green-700' : 'text-amber-700') + ' text-sm'}>
            {data?.balanced && data?.mismatchCount===0 ? 'OK' : `Écarts: ${data?.mismatchCount ?? 0}`}
          </div>
        </div>
      </div>
      {err && <div className="text-xs text-amber-700">{err}</div>}
      <table className="text-sm min-w-[600px] border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Rubrique</th>
            <th className="px-2 py-1 text-right">Bulletins</th>
            <th className="px-2 py-1 text-right">Journal</th>
            <th className="px-2 py-1 text-right">Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-2 py-1">{r.label}</td>
              <td className="px-2 py-1 text-right">{r.slips.toFixed(2)}</td>
              <td className="px-2 py-1 text-right">{r.ledger.toFixed(2)}</td>
              <td className={(Math.abs(r.delta) > tol ? 'text-amber-700' : 'text-gray-700') + ' px-2 py-1 text-right'}>{r.delta.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="border-t bg-gray-50">
            <td className="px-2 py-1">Totaux</td>
            <td className="px-2 py-1 text-right" colSpan={3}>Débit {data?.debitTotal?.toFixed?.(2) ?? '0.00'} • Crédit {data?.creditTotal?.toFixed?.(2) ?? '0.00'}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
