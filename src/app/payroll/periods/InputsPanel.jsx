"use client";

import { useEffect, useMemo, useState } from 'react';

function toNumber(x) { return typeof x === 'number' ? x : Number(x ?? 0); }

export default function InputsPanel({ periodId, employees, costCenters, readonly }) {
  const [attendance, setAttendance] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formA, setFormA] = useState({ employeeId: '', daysWorked: '', workingDays: '30', overtimeHours: '', notes: '' });
  const [formV, setFormV] = useState({ employeeId: '', kind: 'BONUS', label: '', amount: '', costCenterId: '' });
  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees]);

  async function refreshAll() {
    setLoading(true);
    try {
      const [a, v] = await Promise.all([
        fetch(`/api/payroll/period/${periodId}/attendance`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/payroll/period/${periodId}/variables`, { cache: 'no-store' }).then(r => r.json()),
      ]);
      setAttendance(a?.rows ?? []);
      setVariables(v?.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshAll(); }, [periodId]);

  async function saveAttendance(e) {
    e.preventDefault();
    if (readonly) return;
    const payload = {
      employeeId: formA.employeeId,
      daysWorked: formA.daysWorked ? Number(formA.daysWorked) : null,
      workingDays: formA.workingDays ? Number(formA.workingDays) : null,
      overtimeHours: formA.overtimeHours ? Number(formA.overtimeHours) : null,
      notes: formA.notes || null,
    };
    const res = await fetch(`/api/payroll/period/${periodId}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { setFormA({ employeeId: '', daysWorked: '', workingDays: '30', overtimeHours: '', notes: '' }); await refreshAll(); }
  }

  async function addVariable(e) {
    e.preventDefault();
    if (readonly) return;
    const payload = {
      employeeId: formV.employeeId,
      kind: formV.kind,
      label: formV.label || formV.kind,
      amount: formV.amount ? Number(formV.amount) : 0,
      costCenterId: formV.costCenterId || null,
    };
    const res = await fetch(`/api/payroll/period/${periodId}/variables`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) { setFormV({ employeeId: '', kind: 'BONUS', label: '', amount: '', costCenterId: '' }); await refreshAll(); }
  }

  async function removeVariable(id) {
    if (readonly) return;
    const res = await fetch(`/api/payroll/period/${periodId}/variables?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) await refreshAll();
  }

  async function recalcAll() {
    if (readonly) return;
    const res = await fetch(`/api/payroll/period/${periodId}/generate`, { method: 'POST' });
    if (res.ok) alert('Recalcul terminé');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <button disabled={readonly || loading} onClick={refreshAll} className="px-3 py-1 border rounded">Rafraîchir</button>
        <button disabled={readonly || loading} onClick={recalcAll} className="px-3 py-1 border rounded bg-blue-600 text-white">Recalculer tous les bulletins</button>
        {readonly && <span className="text-gray-500">Lecture seule (période non-OPEN)</span>}
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Présence (pro-rata de base)</h2>
        <form onSubmit={saveAttendance} className="flex flex-wrap items-end gap-2 text-sm">
          <select className="border px-2 py-1" value={formA.employeeId} onChange={e => setFormA(f => ({ ...f, employeeId: e.target.value }))} disabled={readonly}>
            <option value="">Employé…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{(e.employeeNumber || '') + ' ' + e.lastName + ' ' + e.firstName}</option>)}
          </select>
          <label className="flex flex-col">Jours travaillés<input className="border px-2 py-1" type="number" step="0.001" value={formA.daysWorked} onChange={e => setFormA(f => ({ ...f, daysWorked: e.target.value }))} disabled={readonly} /></label>
          <label className="flex flex-col">Jours ouvrés<input className="border px-2 py-1" type="number" step="0.001" value={formA.workingDays} onChange={e => setFormA(f => ({ ...f, workingDays: e.target.value }))} disabled={readonly} /></label>
          <label className="flex flex-col">Heures supp<input className="border px-2 py-1" type="number" step="0.01" value={formA.overtimeHours} onChange={e => setFormA(f => ({ ...f, overtimeHours: e.target.value }))} disabled={readonly} /></label>
          <input className="border px-2 py-1" placeholder="Notes" value={formA.notes} onChange={e => setFormA(f => ({ ...f, notes: e.target.value }))} disabled={readonly} />
          <button className="px-3 py-1 border rounded bg-green-600 text-white" disabled={readonly}>Enregistrer</button>
        </form>
        <table className="text-sm min-w-[600px] border">
          <thead><tr className="bg-gray-100"><th className="px-2 py-1 text-left">Employé</th><th className="px-2 py-1 text-left">Jours</th><th className="px-2 py-1 text-left">Ouvrés</th><th className="px-2 py-1 text-left">HS</th><th className="px-2 py-1 text-left">Notes</th></tr></thead>
          <tbody>
            {attendance.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1">{(empMap[r.employeeId]?.employeeNumber || '') + ' ' + empMap[r.employeeId]?.lastName + ' ' + empMap[r.employeeId]?.firstName}</td>
                <td className="px-2 py-1">{toNumber(r.daysWorked)}</td>
                <td className="px-2 py-1">{toNumber(r.workingDays)}</td>
                <td className="px-2 py-1">{toNumber(r.overtimeHours)}</td>
                <td className="px-2 py-1">{r.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Variables (bonus/indemnités/retenues)</h2>
        <form onSubmit={addVariable} className="flex flex-wrap items-end gap-2 text-sm">
          <select className="border px-2 py-1" value={formV.employeeId} onChange={e => setFormV(f => ({ ...f, employeeId: e.target.value }))} disabled={readonly}>
            <option value="">Employé…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{(e.employeeNumber || '') + ' ' + e.lastName + ' ' + e.firstName}</option>)}
          </select>
          <select className="border px-2 py-1" value={formV.kind} onChange={e => setFormV(f => ({ ...f, kind: e.target.value }))} disabled={readonly}>
            <option value="BONUS">BONUS</option>
            <option value="ALLOWANCE">ALLOWANCE</option>
            <option value="DEDUCTION">DEDUCTION</option>
          </select>
          <input className="border px-2 py-1" placeholder="Libellé" value={formV.label} onChange={e => setFormV(f => ({ ...f, label: e.target.value }))} disabled={readonly} />
          <input className="border px-2 py-1" type="number" step="0.01" placeholder="Montant" value={formV.amount} onChange={e => setFormV(f => ({ ...f, amount: e.target.value }))} disabled={readonly} />
          <select className="border px-2 py-1" value={formV.costCenterId} onChange={e => setFormV(f => ({ ...f, costCenterId: e.target.value }))} disabled={readonly}>
            <option value="">Centre de coûts (optionnel)</option>
            {costCenters.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.code} — {c.label}</option>)}
          </select>
          <button className="px-3 py-1 border rounded bg-green-600 text-white" disabled={readonly}>Ajouter</button>
        </form>
        <table className="text-sm min-w-[600px] border">
          <thead><tr className="bg-gray-100"><th className="px-2 py-1 text-left">Employé</th><th className="px-2 py-1 text-left">Kind</th><th className="px-2 py-1 text-left">Libellé</th><th className="px-2 py-1 text-left">Montant</th><th className="px-2 py-1 text-left">CC</th><th className="px-2 py-1">Actions</th></tr></thead>
          <tbody>
            {variables.map(v => (
              <tr key={v.id} className="border-t">
                <td className="px-2 py-1">{(empMap[v.employeeId]?.employeeNumber || '') + ' ' + empMap[v.employeeId]?.lastName + ' ' + empMap[v.employeeId]?.firstName}</td>
                <td className="px-2 py-1">{v.kind}</td>
                <td className="px-2 py-1">{v.label}</td>
                <td className="px-2 py-1">{toNumber(v.amount)}</td>
                <td className="px-2 py-1">{v.costCenter?.code || ''}</td>
                <td className="px-2 py-1 text-center">
                  <button disabled={readonly} onClick={() => removeVariable(v.id)} className="px-2 py-0.5 border rounded text-red-700">Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
