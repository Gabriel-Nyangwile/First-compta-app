"use client";
import { useEffect, useState, useCallback } from 'react';

const btnBase = 'px-3 py-1 text-xs rounded border font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500';
function Btn({ children, onClick, variant='primary', disabled }) {
  const cls = variant==='danger'
    ? `${btnBase} bg-red-50 hover:bg-red-100 border-red-300 text-red-700`
    : variant==='neutral'
      ? `${btnBase} bg-white hover:bg-gray-50 border-gray-300 text-gray-700`
      : `${btnBase} bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700`;
  return <button disabled={disabled} onClick={onClick} className={cls}>{children}</button>;
}

function useToasts() {
  const [toasts, set] = useState([]);
  const push = useCallback((msg, type='info') => {
    const id = Date.now()+Math.random();
    set(t => [...t, { id, msg, type }]);
    setTimeout(()=>set(t => t.filter(x=>x.id!==id)), 4200);
  }, []);
  return { toasts, push };
}

function Toasts({ toasts }) {
  return <div className="fixed top-4 right-4 space-y-2 z-50">
    {toasts.map(t => <div key={t.id} className={`text-xs px-3 py-2 rounded border shadow-sm bg-white ${t.type==='error'?'border-red-400 text-red-700':'border-gray-300 text-gray-800'}`}>{t.type==='error'?'⚠️':'✅'} {t.msg}</div>)}
  </div>;
}

export default function RunWizard() {
  const { toasts, push } = useToasts();
  const [periods, setPeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [locking, setLocking] = useState(false);
  const [lockedInfo, setLockedInfo] = useState(null);

  async function loadPeriods() {
    setLoadingPeriods(true);
    try {
      const res = await fetch('/api/payroll/periods?status=OPEN', { cache:'no-store' });
      if (!res.ok) throw new Error('Erreur listing périodes');
      const json = await res.json();
      setPeriods(json.periods || []);
      if (!selectedPeriodId && json.periods?.length) setSelectedPeriodId(json.periods[0].id);
    } catch(e){ push(e.message,'error'); } finally { setLoadingPeriods(false); }
  }

  useEffect(() => { loadPeriods(); }, []);

  async function createCurrentPeriod() {
    const now = new Date();
    const body = { month: now.getMonth()+1, year: now.getFullYear() };
    try {
      const res = await fetch('/api/payroll/period', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      push('Période créée');
      await loadPeriods();
    } catch(e){ push(e.message||'Erreur création période','error'); }
  }

  async function loadPreview() {
    if (!selectedPeriodId) return;
    setPreviewLoading(true); setPreview(null); setGenerateResult(null);
    try {
      const res = await fetch(`/api/payroll/period/${selectedPeriodId}/preview`, { cache:'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setPreview(json);
      push(`Prévisualisation ${json.count} employés`);
    } catch(e){ push(e.message || 'Erreur preview','error'); } finally { setPreviewLoading(false); }
  }

  async function generatePayslips() {
    if (!selectedPeriodId) return;
    setGenerateLoading(true); setGenerateResult(null);
    try {
      const res = await fetch(`/api/payroll/period/${selectedPeriodId}/generate`, { method:'POST' });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setGenerateResult(json);
      push(`Généré ${json.count} bulletins`);
    } catch(e){ push(e.message || 'Erreur génération','error'); } finally { setGenerateLoading(false); }
  }

  async function lockPeriod() {
    if (!selectedPeriodId) return;
    setLocking(true); setLockedInfo(null);
    try {
      const res = await fetch(`/api/payroll/period/${selectedPeriodId}/lock`, { method:'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lock failed');
      setLockedInfo(json);
      push('Période verrouillée');
      await loadPeriods();
    } catch(e){ push(e.message || 'Erreur verrouillage','error'); } finally { setLocking(false); }
  }

  function exportCsv() {
    if (!preview?.results?.length) { push('Rien à exporter','error'); return; }
    const headers = ['employeeId','employeeName','gross','net','cnssEmployee','iprTax','riBase','fxRate','employerCharges','cnssEmployer','onem','inpp','overtime','lineCount'];
    const rows = preview.results.map(r => [
      r.employeeId,
      r.employeeName,
      r.gross.toFixed(2),
      r.net.toFixed(2),
      (r.cnssEmployee??0).toFixed(2),
      (r.iprTax??0).toFixed(2),
      r.riBase==null?'':Number(r.riBase).toFixed(2),
      r.fxRate==null?'':r.fxRate,
      r.employerCharges.toFixed(2),
      (r.cnssEmployer??0).toFixed(2),
      (r.onem??0).toFixed(2),
      (r.inpp??0).toFixed(2),
      (r.overtime??0).toFixed(2),
      r.lines.length
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `preview_${selectedPeriod?.ref || 'period'}.csv`; a.click();
    URL.revokeObjectURL(url);
    push('CSV exporté');
  }

  function exportLinesCsv() {
    if (!preview?.results?.length) { push('Rien à exporter','error'); return; }
    const headers = ['employeeId','employeeName','lineCode','lineLabel','kind','amount','baseAmount','order'];
    const rows = [];
    for (const r of preview.results) {
      for (const l of r.lines) {
        rows.push([
          r.employeeId,
          r.employeeName,
          l.code,
          l.label,
          l.kind,
          Number(l.amount ?? 0).toFixed(2),
          l.baseAmount == null ? '' : Number(l.baseAmount).toFixed(2),
          l.order ?? ''
        ]);
      }
    }
    const csv = [headers.join(','), ...rows.map(row => row.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `preview_lines_${selectedPeriod?.ref || 'period'}.csv`; a.click();
    URL.revokeObjectURL(url);
    push('CSV lignes exporté');
  }

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

  return (
    <div className="space-y-4">
      <Toasts toasts={toasts} />
      <div className="border rounded p-3 bg-gray-50 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Période ouverte:</span>
          {loadingPeriods && <span className="text-xs">Chargement...</span>}
          {(!loadingPeriods && !periods.length) && <span className="text-xs text-red-700">Aucune période OPEN.</span>}
          {periods.length > 0 && (
            <select value={selectedPeriodId||''} onChange={e=>setSelectedPeriodId(e.target.value)} className="text-xs border rounded px-2 py-1 bg-white">
              {periods.map(p => <option key={p.id} value={p.id}>{p.ref} ({p.month}/{p.year})</option>)}
            </select>
          )}
          <Btn variant="primary" onClick={loadPeriods} disabled={loadingPeriods}>Rafraîchir</Btn>
          <Btn variant="neutral" onClick={createCurrentPeriod} disabled={loadingPeriods}>Créer période courante</Btn>
        </div>
        {selectedPeriod && <div className="text-[11px] text-gray-600">Sélection: {selectedPeriod.ref} — {selectedPeriod.month}/{selectedPeriod.year}</div>}
        <div className="flex gap-2 mt-2 flex-wrap">
          <Btn onClick={loadPreview} disabled={!selectedPeriodId || previewLoading}>Prévisualiser</Btn>
          <Btn variant="primary" onClick={exportCsv} disabled={!preview?.count}>Exporter CSV Synthèse</Btn>
          <Btn variant="neutral" onClick={exportLinesCsv} disabled={!preview?.count}>Exporter CSV Lignes</Btn>
          <Btn variant="danger" onClick={generatePayslips} disabled={!selectedPeriodId || generateLoading || !preview?.count}>Générer bulletins</Btn>
          <Btn variant="neutral" onClick={lockPeriod} disabled={!generateResult?.count || locking}>Verrouiller période</Btn>
        </div>
      </div>
      {previewLoading && <div className="text-xs">Calcul en cours...</div>}
      {preview && (
        <div className="space-y-2">
          <h2 className="font-medium text-sm">Prévisualisation ({preview.count})</h2>
          <div className="overflow-x-auto border rounded bg-white">
            <table className="text-xs min-w-[1100px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-100 text-gray-600 uppercase">
                  <th className="px-2 py-1 text-left">Employé</th>
                  <th className="px-2 py-1 text-left">Brut</th>
                  <th className="px-2 py-1 text-left">Net</th>
                  <th className="px-2 py-1 text-left">CNSS Sal.</th>
                  <th className="px-2 py-1 text-left">IPR</th>
                  <th className="px-2 py-1 text-left">RI Base</th>
                  <th className="px-2 py-1 text-left">CNSS Emp.</th>
                  <th className="px-2 py-1 text-left">ONEM</th>
                  <th className="px-2 py-1 text-left">INPP</th>
                  <th className="px-2 py-1 text-left">Charges Employeur</th>
                  <th className="px-2 py-1 text-left">Lignes</th>
                </tr>
              </thead>
              <tbody>
                {preview.results.map(r => (
                  <tr key={r.employeeId} className="border-t odd:bg-white even:bg-gray-50">
                    <td className="px-2 py-1">{r.employeeName}</td>
                    <td className="px-2 py-1">{r.gross.toFixed(2)}</td>
                    <td className="px-2 py-1">{r.net.toFixed(2)}</td>
                    <td className="px-2 py-1">{(r.cnssEmployee??0).toFixed(2)}</td>
                    <td className="px-2 py-1">{(r.iprTax??0).toFixed(2)}</td>
                    <td className="px-2 py-1">{r.riBase==null?'':Number(r.riBase).toFixed(2)}</td>
                    <td className="px-2 py-1">{(r.cnssEmployer??0).toFixed(2)}</td>
                    <td className="px-2 py-1">{(r.onem??0).toFixed(2)}</td>
                    <td className="px-2 py-1">{(r.inpp??0).toFixed(2)}</td>
                    <td className="px-2 py-1">{r.employerCharges.toFixed(2)}</td>
                    <td className="px-2 py-1">{r.lines.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {generateResult && (
        <div className="border rounded p-3 bg-green-50 text-xs text-green-800">
          <div className="font-medium mb-1">Résultat génération</div>
          <div>Bulletins générés: {generateResult.count}</div>
          <div className="mt-1">Consulter période: <a className="underline" href={`/payroll/periods/${selectedPeriod?.ref}`}>{selectedPeriod?.ref}</a></div>
        </div>
      )}
      {lockedInfo && (
        <div className="border rounded p-3 bg-yellow-50 text-xs text-yellow-800">
          <div className="font-medium mb-1">Période verrouillée</div>
          <div>Ref: {lockedInfo.periodRef} – {lockedInfo.payslipsLocked} bulletins verrouillés</div>
          <div>LockedAt: {lockedInfo.lockedAt}</div>
        </div>
      )}
    </div>
  );
}
