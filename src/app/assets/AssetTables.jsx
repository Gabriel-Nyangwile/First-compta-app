'use client';

import { useEffect, useMemo, useState } from 'react';

async function apiJSON(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function getStatus(err) {
  return err?.status;
}

function Toast({ toast }) {
  if (!toast) return null;
  const color = toast.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
  return (
    <div className="fixed top-4 right-4 z-50 shadow-lg">
      <div className={`px-3 py-2 text-sm rounded border ${color}`}>
        {toast.msg}
      </div>
    </div>
  );
}

export default function AssetTables({ initialCategories = [], initialAssets = [] }) {
  const now = useMemo(() => new Date(), []);
  const [categories, setCategories] = useState(initialCategories);
  const [assets, setAssets] = useState(initialAssets);
  const [toast, setToast] = useState(null);
  const [globalAlert, setGlobalAlert] = useState(null); // bandeau persistant pour erreurs

  const [loading, setLoading] = useState(false);
  const [catForm, setCatForm] = useState({
    code: '',
    label: '',
    durationMonths: 36,
    assetAccountNumber: '',
    depreciationAccountNumber: '',
    expenseAccountNumber: '',
    disposalGainAccountNumber: '',
    disposalLossAccountNumber: '',
  });
  const [assetForm, setAssetForm] = useState({
    label: '',
    categoryId: '',
    acquisitionDate: now.toISOString().slice(0, 10),
    cost: '',
    salvage: '',
    usefulLifeMonths: 36,
  });
  const [catEditId, setCatEditId] = useState(null);
  const [catEditForm, setCatEditForm] = useState(null);
  const [assetEditId, setAssetEditId] = useState(null);
  const [assetEditForm, setAssetEditForm] = useState(null);
  const [exportParams, setExportParams] = useState({ from: '', to: '' });
  const [scheduleYear, setScheduleYear] = useState(now.getFullYear());
  const [scheduleFilters, setScheduleFilters] = useState({ categoryId: '', status: '' });
  const [batchPeriod, setBatchPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [periodInputs, setPeriodInputs] = useState(() => Object.fromEntries(initialAssets.map(a => [a.id, { year: now.getFullYear(), month: now.getMonth() + 1 }])));
  const [disposeInputs, setDisposeInputs] = useState(() => Object.fromEntries(initialAssets.map(a => [a.id, { proceed: '', date: now.toISOString().slice(0, 10) }])));
  const [locks, setLocks] = useState([]);
  const [lockPeriod, setLockPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  useEffect(() => {
    setPeriodInputs(Object.fromEntries(initialAssets.map(a => [a.id, { year: now.getFullYear(), month: now.getMonth() + 1 }])));
    setDisposeInputs(Object.fromEntries(initialAssets.map(a => [a.id, { proceed: '', date: now.toISOString().slice(0, 10) }])));
  }, [initialAssets, now]);

  function pushToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 6000);
  }
  function pushGlobal(msg, type = "error") {
    setGlobalAlert({ msg, type });
    setTimeout(() => setGlobalAlert(null), 10000);
  }

  async function refresh() {
    setLoading(true);
    try {
      const [cats, assetsRes, locksRes] = await Promise.all([
        apiJSON('/api/asset-categories'),
        apiJSON('/api/assets'),
        apiJSON('/api/assets/depreciations/lock').catch(() => ({ locks: [] })),
      ]);
      setCategories(cats.categories || []);
      setAssets(assetsRes.assets || []);
      setLocks(locksRes.locks || []);
      setCatEditId(null); setCatEditForm(null);
      setAssetEditId(null); setAssetEditForm(null);
    } catch (e) {
      pushToast(e.message || 'Erreur rafraîchissement', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Charge les verrous séparément pour gérer la réponse
  useEffect(() => {
    async function loadLocks() {
      try {
        const res = await apiJSON('/api/assets/depreciations/lock');
        setLocks(res.locks || []);
      } catch {
        setLocks([]);
      }
    }
    loadLocks();
  }, []);

  async function submitCategory(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiJSON('/api/asset-categories', { method: 'POST', body: { ...catForm, durationMonths: Number(catForm.durationMonths) } });
      pushToast('Catégorie ajoutée');
      setCatForm({
        code: '',
        label: '',
        durationMonths: 36,
        assetAccountNumber: '',
        depreciationAccountNumber: '',
        expenseAccountNumber: '',
        disposalGainAccountNumber: '',
        disposalLossAccountNumber: '',
      });
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur catégorie', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function submitAsset(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiJSON('/api/assets', {
        method: 'POST',
        body: {
          ...assetForm,
          cost: Number(assetForm.cost),
          salvage: assetForm.salvage ? Number(assetForm.salvage) : 0,
          usefulLifeMonths: Number(categories.find(c => c.id === assetForm.categoryId)?.durationMonths ?? assetForm.usefulLifeMonths),
        },
      });
      pushToast('Immobilisation ajoutée');
      setAssetForm({
        label: '',
        categoryId: assetForm.categoryId,
        acquisitionDate: now.toISOString().slice(0, 10),
        cost: '',
        salvage: '',
        usefulLifeMonths: categories.find(c => c.id === assetForm.categoryId)?.durationMonths ?? 36,
      });
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur création immobilisation', 'error');
    } finally {
      setLoading(false);
    }
  }

  function setPeriod(assetId, field, value) {
    setPeriodInputs(prev => ({ ...prev, [assetId]: { ...prev[assetId], [field]: value } }));
  }
  function setDispose(assetId, field, value) {
    setDisposeInputs(prev => ({ ...prev, [assetId]: { ...prev[assetId], [field]: value } }));
  }

  async function saveCategoryEdit() {
    if (!catEditId || !catEditForm) return;
    setLoading(true);
    try {
      await apiJSON(`/api/asset-categories/${catEditId}`, {
        method: 'PUT',
        body: {
          ...catEditForm,
          durationMonths: Number(catEditForm.durationMonths),
        },
      });
      pushToast('Catégorie mise à jour');
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur maj catégorie', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Supprimer cette catégorie ?')) return;
    setLoading(true);
    try {
      await apiJSON(`/api/asset-categories/${id}`, { method: 'DELETE' });
      pushToast('Catégorie supprimée');
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur suppression catégorie', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveAssetEdit() {
    if (!assetEditId || !assetEditForm) return;
    setLoading(true);
    try {
      const catDuration = categories.find(c => c.id === assetEditForm.categoryId)?.durationMonths;
      await apiJSON(`/api/assets/${assetEditId}`, {
        method: 'PUT',
        body: {
          ...assetEditForm,
          cost: assetEditForm.cost !== '' ? Number(assetEditForm.cost) : undefined,
          salvage: assetEditForm.salvage !== '' ? Number(assetEditForm.salvage) : undefined,
          usefulLifeMonths: catDuration ?? undefined,
        },
      });
      pushToast('Immobilisation mise à jour');
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur maj immobilisation', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAsset(id) {
    if (!confirm('Supprimer cette immobilisation ?')) return;
    setLoading(true);
    try {
      await apiJSON(`/api/assets/${id}`, { method: 'DELETE' });
      pushToast('Immobilisation supprimée');
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur suppression immobilisation', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function generateLine(assetId) {
    const p = periodInputs[assetId] || {};
    if (!p.year || !p.month) return pushToast('Année et mois requis', 'error');
    setLoading(true);
    try {
      await apiJSON(`/api/assets/${assetId}/depreciation`, { method: 'POST', body: { year: Number(p.year), month: Number(p.month) } });
      pushToast('Dotation générée');
      await refresh();
    } catch (e) {
      const lower = (e.message || '').toLowerCase();
      const status = getStatus(e);
      const msg409 = 'Période déjà postée ou verrouillée';
      if (status === 409 || lower.includes('post') || lower.includes('verrouillee')) {
        pushToast(msg409, 'error');
        pushGlobal(msg409, 'error');
      } else {
        const msg = lower.includes('verrouillee') ? 'Période verrouillée' : (e.message || 'Erreur génération');
        pushToast(msg, 'error');
        pushGlobal(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function postLine(assetId) {
    const p = periodInputs[assetId] || {};
    if (!p.year || !p.month) return pushToast('Année et mois requis', 'error');
    setLoading(true);
    try {
      await apiJSON(`/api/assets/${assetId}/depreciation/post`, { method: 'POST', body: { year: Number(p.year), month: Number(p.month) } });
      pushToast('Dotation postée');
      await refresh();
    } catch (e) {
      const lower = (e.message || '').toLowerCase();
      const status = getStatus(e);
      const msg409 = 'Période déjà postée ou verrouillée';
      if (status === 409 || lower.includes('post') || lower.includes('verrouillee')) {
        pushToast(msg409, 'error');
        pushGlobal(msg409, 'error');
      } else {
        const msg = lower.includes('verrouillee') ? 'Période verrouillée' : (e.message || 'Erreur posting');
        pushToast(msg, 'error');
        pushGlobal(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function dispose(assetId) {
    const d = disposeInputs[assetId] || {};
    setLoading(true);
    try {
      await apiJSON(`/api/assets/${assetId}/dispose`, { method: 'POST', body: { date: d.date, proceed: d.proceed ? Number(d.proceed) : 0 } });
      pushToast('Cession enregistrée');
      await refresh();
    } catch (e) {
      pushToast(e.message || 'Erreur cession', 'error');
    } finally {
      setLoading(false);
    }
  }

  const latestDep = (asset) => {
    if (!asset.depreciationLines?.length) return null;
    const sorted = [...asset.depreciationLines].sort((a, b) => (b.year - a.year) || (b.month - a.month));
    return sorted[0];
  };

  function exportDepreciations() {
    const params = new URLSearchParams();
    if (exportParams.from) params.set('from', exportParams.from);
    if (exportParams.to) params.set('to', exportParams.to);
    params.set('format', 'csv');
    const url = `/api/assets/depreciations/export?${params.toString()}`;
    window.open(url, '_blank');
  }

  function exportSchedule(format) {
    if (!scheduleYear) {
      pushToast('Année requise', 'error');
      return;
    }
    const params = new URLSearchParams();
    params.set('year', scheduleYear);
    params.set('format', format);
    if (scheduleFilters.categoryId) params.set('categoryId', scheduleFilters.categoryId);
    if (scheduleFilters.status) params.set('status', scheduleFilters.status);
    const url = `/api/assets/depreciations/schedule?${params.toString()}`;
    window.open(url, '_blank');
  }

  async function toggleLock(action = 'lock') {
    if (!lockPeriod.year || !lockPeriod.month) {
      pushToast('Année et mois requis', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiJSON('/api/assets/depreciations/lock', {
        method: 'POST',
        body: {
          year: Number(lockPeriod.year),
          month: Number(lockPeriod.month),
          action,
        },
      });
      const res = await apiJSON('/api/assets/depreciations/lock');
      setLocks(res.locks || []);
      pushToast(action === 'lock' ? 'Période verrouillée' : 'Période déverrouillée');
    } catch (e) {
      pushToast(e.message || 'Erreur lock', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function postBatch() {
    setLoading(true);
    try {
      await apiJSON('/api/assets/depreciations/post', { method: 'POST', body: { year: Number(batchPeriod.year), month: Number(batchPeriod.month) } });
      pushToast('Dotations mensuelles postées (batch)');
      await refresh();
    } catch (e) {
      const lower = (e.message || '').toLowerCase();
      const status = getStatus(e);
      const msg409 = 'Période déjà postée ou verrouillée';
      if (status === 409 || lower.includes('post') || lower.includes('verrouillee')) {
        pushToast(msg409, 'error');
        pushGlobal(msg409, 'error');
      } else {
        const msg = lower.includes('verrouillee') ? 'Période verrouillée' : (e.message || 'Erreur posting batch');
        pushToast(msg, 'error');
        pushGlobal(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Catégories</h2>
        <button onClick={refresh} className="text-sm text-blue-600 underline disabled:opacity-50" disabled={loading}>Rafraîchir</button>
      </div>
      <Toast toast={toast} />
      {globalAlert ? (
        <div className={`px-3 py-2 text-sm rounded border ${globalAlert.type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}>
          {globalAlert.msg}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={submitCategory} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Nouvelle catégorie</span>
            <button type="submit" className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading}>Ajouter</button>
          </div>
          <p className="text-xs text-gray-600">Astuce : préremplir avec un modèle type OHADA (matériel IT) ou adapter vos comptes 2xx/28xx/68xx/754xxx/654xxx.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => setCatForm({
              code: 'IMM-IT',
              label: 'Matériel informatique',
              durationMonths: 36,
              assetAccountNumber: '218300',
              depreciationAccountNumber: '281830',
              expenseAccountNumber: '681120',
              disposalGainAccountNumber: '754000',
              disposalLossAccountNumber: '654000',
            })}>Préremplir IT (3 ans)</button>
            <button type="button" className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => setCatForm({
              ...catForm,
              disposalGainAccountNumber: '754000',
              disposalLossAccountNumber: '654000',
            })}>Ajouter comptes gain/perte</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span>Code</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.code} onChange={e => setCatForm({ ...catForm, code: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span>Libellé</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.label} onChange={e => setCatForm({ ...catForm, label: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span>Durée (mois) (catégorie)</span>
              <input type="number" className="w-full border px-2 py-1 rounded" value={catForm.durationMonths} onChange={e => setCatForm({ ...catForm, durationMonths: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span>Compte actif</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.assetAccountNumber} onChange={e => setCatForm({ ...catForm, assetAccountNumber: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span>Compte amort. cumulé</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.depreciationAccountNumber} onChange={e => setCatForm({ ...catForm, depreciationAccountNumber: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span>Compte charge</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.expenseAccountNumber} onChange={e => setCatForm({ ...catForm, expenseAccountNumber: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span>Compte gain cession</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.disposalGainAccountNumber} onChange={e => setCatForm({ ...catForm, disposalGainAccountNumber: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span>Compte perte cession</span>
              <input className="w-full border px-2 py-1 rounded" value={catForm.disposalLossAccountNumber} onChange={e => setCatForm({ ...catForm, disposalLossAccountNumber: e.target.value })} />
            </label>
          </div>
        </form>

        <form onSubmit={submitAsset} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Nouvelle immobilisation</span>
            <button type="submit" className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading}>Ajouter</button>
          </div>
          <p className="text-xs text-gray-600">Tips : durée mensuelle = durée d’amortissement. Préremplir un laptop 3 ans via le bouton ci-dessous.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => setAssetForm({
              label: 'Laptop démo',
              categoryId: assetForm.categoryId || (categories[0]?.id || ''),
              acquisitionDate: now.toISOString().slice(0, 10),
              cost: 1200,
              salvage: 0,
              usefulLifeMonths: categories.find(c => c.id === (assetForm.categoryId || categories[0]?.id))?.durationMonths ?? 36,
              inServiceDate: now.toISOString().slice(0, 10),
            })}>Préremplir laptop (36 mois)</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span>Libellé</span>
              <input className="w-full border px-2 py-1 rounded" value={assetForm.label} onChange={e => setAssetForm({ ...assetForm, label: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span>Catégorie</span>
              <select
                className="w-full border px-2 py-1 rounded"
                value={assetForm.categoryId}
                onChange={e => {
                  const catId = e.target.value;
                  const cat = categories.find(c => c.id === catId);
                  setAssetForm({ ...assetForm, categoryId: catId, usefulLifeMonths: cat?.durationMonths ?? assetForm.usefulLifeMonths });
                }}
                required
              >
                <option value="">--</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code} · {c.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span>Acquisition</span>
              <input type="date" className="w-full border px-2 py-1 rounded" value={assetForm.acquisitionDate} onChange={e => setAssetForm({ ...assetForm, acquisitionDate: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span>Mise en service</span>
              <input type="date" className="w-full border px-2 py-1 rounded" value={assetForm.inServiceDate || ''} onChange={e => setAssetForm({ ...assetForm, inServiceDate: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span>Coût</span>
              <input type="number" step="0.01" className="w-full border px-2 py-1 rounded" value={assetForm.cost} onChange={e => setAssetForm({ ...assetForm, cost: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span>Valeur résiduelle</span>
              <input type="number" step="0.01" className="w-full border px-2 py-1 rounded" value={assetForm.salvage} onChange={e => setAssetForm({ ...assetForm, salvage: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span>Durée (mois)</span>
              <input type="number" className="w-full border px-2 py-1 rounded bg-gray-100 text-gray-700" value={assetForm.usefulLifeMonths} disabled readOnly />
            </label>
          </div>
        </form>
      </div>

      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <h3 className="font-medium">Catégories existantes</h3>
          <p className="text-xs text-gray-600">Éditez ou supprimez (attention : suppression impossible si des actifs y sont rattachés).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-left">Durée</th>
                <th className="px-3 py-2 text-left">Comptes clés</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const editing = catEditId === c.id;
                const form = editing ? catEditForm : c;
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">
                      {editing
                        ? <input className="w-28 border px-2 py-1 rounded text-xs" value={form.code} onChange={e => setCatEditForm({ ...form, code: e.target.value })} />
                        : c.code}
                    </td>
                    <td className="px-3 py-2">
                      {editing
                        ? <input className="w-40 border px-2 py-1 rounded text-xs" value={form.label} onChange={e => setCatEditForm({ ...form, label: e.target.value })} />
                        : c.label}
                    </td>
                    <td className="px-3 py-2">
                      {editing
                        ? <input type="number" className="w-20 border px-2 py-1 rounded text-xs" value={form.durationMonths} onChange={e => setCatEditForm({ ...form, durationMonths: e.target.value })} />
                        : `${c.durationMonths} mois`}
                    </td>
                    <td className="px-3 py-2 text-xs leading-5">
                      {editing ? (
                        <div className="space-y-1">
                          <input className="w-28 border px-2 py-1 rounded" placeholder="2xx" value={form.assetAccountNumber || ''} onChange={e => setCatEditForm({ ...form, assetAccountNumber: e.target.value })} />
                          <input className="w-28 border px-2 py-1 rounded" placeholder="28xx" value={form.depreciationAccountNumber || ''} onChange={e => setCatEditForm({ ...form, depreciationAccountNumber: e.target.value })} />
                          <input className="w-28 border px-2 py-1 rounded" placeholder="68xx" value={form.expenseAccountNumber || ''} onChange={e => setCatEditForm({ ...form, expenseAccountNumber: e.target.value })} />
                          <input className="w-28 border px-2 py-1 rounded" placeholder="754xxx" value={form.disposalGainAccountNumber || ''} onChange={e => setCatEditForm({ ...form, disposalGainAccountNumber: e.target.value })} />
                          <input className="w-28 border px-2 py-1 rounded" placeholder="654xxx" value={form.disposalLossAccountNumber || ''} onChange={e => setCatEditForm({ ...form, disposalLossAccountNumber: e.target.value })} />
                        </div>
                      ) : (
                        <>
                          <div>Actif: {c.assetAccountNumber || '—'}</div>
                          <div>Amort.: {c.depreciationAccountNumber || '—'}</div>
                          <div>Charge: {c.expenseAccountNumber || '—'}</div>
                          <div>Gain: {c.disposalGainAccountNumber || '—'}</div>
                          <div>Perte: {c.disposalLossAccountNumber || '—'}</div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 space-x-2 text-xs">
                      {editing ? (
                        <>
                          <button className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading} onClick={saveCategoryEdit}>Sauver</button>
                          <button className="px-2 py-1 border rounded" onClick={() => { setCatEditId(null); setCatEditForm(null); }}>Annuler</button>
                        </>
                      ) : (
                        <>
                          <button className="px-2 py-1 border rounded" onClick={() => { setCatEditId(c.id); setCatEditForm({ ...c }); }}>Éditer</button>
                          <button className="px-2 py-1 border rounded text-red-700" onClick={() => deleteCategory(c.id)} disabled={loading}>Supprimer</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!categories.length && (
                <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-500">Aucune catégorie.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-medium">Immobilisations</h3>
            <p className="text-xs text-gray-600">Actions rapides : générer/poster dotation, enregistrer cession.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <input type="month" className="border px-2 py-1 rounded" value={exportParams.from} onChange={e => setExportParams({ ...exportParams, from: e.target.value })} />
              <span>à</span>
              <input type="month" className="border px-2 py-1 rounded" value={exportParams.to} onChange={e => setExportParams({ ...exportParams, to: e.target.value })} />
              <button className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" onClick={exportDepreciations}>Exporter dotations</button>
              <div className="flex items-center gap-1">
                <input type="number" className="w-20 border px-2 py-1 rounded" value={scheduleYear} onChange={e => setScheduleYear(e.target.value)} />
                <select className="border px-2 py-1 rounded text-xs" value={scheduleFilters.categoryId} onChange={e => setScheduleFilters({ ...scheduleFilters, categoryId: e.target.value })}>
                  <option value="">Catégorie (toutes)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.code} · {c.label}</option>)}
                </select>
                <select className="border px-2 py-1 rounded text-xs" value={scheduleFilters.status} onChange={e => setScheduleFilters({ ...scheduleFilters, status: e.target.value })}>
                  <option value="">Statut (tous)</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="DISPOSED">DISPOSED</option>
                </select>
                <button className="px-2 py-1 text-white bg-emerald-600 hover:bg-emerald-700 rounded" onClick={() => exportSchedule('xlsx')}>Amort. annuel Excel</button>
                <button className="px-2 py-1 text-white bg-indigo-600 hover:bg-indigo-700 rounded" onClick={() => exportSchedule('pdf')}>PDF</button>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" className="w-16 border px-2 py-1 rounded" value={lockPeriod.month} min={1} max={12} onChange={e => setLockPeriod({ ...lockPeriod, month: e.target.value })} />
                <input type="number" className="w-20 border px-2 py-1 rounded" value={lockPeriod.year} onChange={e => setLockPeriod({ ...lockPeriod, year: e.target.value })} />
                <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded" onClick={() => toggleLock('lock')}>Verrouiller période</button>
                <button className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded" onClick={() => toggleLock('unlock')}>Déverrouiller</button>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" className="w-16 border px-2 py-1 rounded" value={batchPeriod.month} min={1} max={12} onChange={e => setBatchPeriod({ ...batchPeriod, month: e.target.value })} />
                <input type="number" className="w-20 border px-2 py-1 rounded" value={batchPeriod.year} onChange={e => setBatchPeriod({ ...batchPeriod, year: e.target.value })} />
                <button className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50" onClick={postBatch} disabled={loading}>Poster batch</button>
              </div>
            </div>
            {loading && <span className="text-xs text-gray-500">Chargement…</span>}
          </div>
          {!!locks.length && (
            <div className="px-4 pb-2 text-xs text-gray-700 flex flex-wrap gap-2">
              {locks.map(l => (
                <span key={`${l.year}-${l.month}`} className="px-2 py-1 bg-red-50 border border-red-200 rounded">
                  Verrouillé {String(l.month).padStart(2, '0')}/{l.year}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Réf</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-left">Coût</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Dernière dotation</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const last = latestDep(a);
                const p = periodInputs[a.id] || { year: now.getFullYear(), month: now.getMonth() + 1 };
                const d = disposeInputs[a.id] || { proceed: '', date: now.toISOString().slice(0, 10) };
                const editing = assetEditId === a.id;
                const form = editing ? assetEditForm : a;
                return (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{a.ref}</td>
                    <td className="px-3 py-2">
                      {editing
                        ? <input className="w-40 border px-2 py-1 rounded text-xs" value={form.label} onChange={e => setAssetEditForm({ ...form, label: e.target.value })} />
                        : a.label}
                    </td>
                    <td className="px-3 py-2">
                      {editing
                        ? (
                          <select
                            className="w-32 border px-2 py-1 rounded text-xs"
                            value={form.categoryId}
                            onChange={e => {
                              const catId = e.target.value;
                              const cat = categories.find(c => c.id === catId);
                              setAssetEditForm({ ...form, categoryId: catId, usefulLifeMonths: cat?.durationMonths ?? form.usefulLifeMonths });
                            }}
                          >
                            {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                          </select>
                        )
                        : a.category?.code}
                    </td>
                    <td className="px-3 py-2">
                      {editing
                        ? <input type="number" step="0.01" className="w-24 border px-2 py-1 rounded text-xs" value={form.cost} onChange={e => setAssetEditForm({ ...form, cost: e.target.value })} />
                        : Number(a.cost).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {editing
                        ? (
                          <select className="w-28 border px-2 py-1 rounded text-xs" value={form.status} onChange={e => setAssetEditForm({ ...form, status: e.target.value })}>
                            <option value="DRAFT">DRAFT</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="DISPOSED">DISPOSED</option>
                          </select>
                        )
                        : a.status}
                    </td>
                    <td className="px-3 py-2">
                      {last ? `${last.month}/${last.year} · ${Number(last.amount).toFixed(2)} ${last.status === 'POSTED' ? '✅' : '⏳'}` : '—'}
                    </td>
                    <td className="px-3 py-2 space-y-2">
                      {editing && (
                        <div className="flex flex-wrap gap-2 items-center">
                          <input type="number" className="w-20 border px-2 py-1 rounded text-xs bg-gray-100 text-gray-700" placeholder="Durée" value={form.usefulLifeMonths || ''} disabled readOnly />
                          <input type="number" step="0.01" className="w-24 border px-2 py-1 rounded text-xs" placeholder="Val. résiduelle" value={form.salvage || ''} onChange={e => setAssetEditForm({ ...form, salvage: e.target.value })} />
                          <input type="date" className="border px-2 py-1 rounded text-xs" value={form.inServiceDate?.slice(0, 10) || ''} onChange={e => setAssetEditForm({ ...form, inServiceDate: e.target.value })} />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 items-center">
                        <input type="number" className="w-20 border px-2 py-1 rounded text-xs" value={p.month} min={1} max={12} onChange={e => setPeriod(a.id, 'month', e.target.value)} />
                        <input type="number" className="w-24 border px-2 py-1 rounded text-xs" value={p.year} onChange={e => setPeriod(a.id, 'year', e.target.value)} />
                        <button className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50" onClick={() => generateLine(a.id)} disabled={loading || a.status === 'DISPOSED'}>Générer</button>
                        <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" onClick={() => postLine(a.id)} disabled={loading || a.status === 'DISPOSED'}>Poster</button>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input type="number" step="0.01" className="w-24 border px-2 py-1 rounded text-xs" placeholder="Produit" value={d.proceed} onChange={e => setDispose(a.id, 'proceed', e.target.value)} />
                        <input type="date" className="border px-2 py-1 rounded text-xs" value={d.date} onChange={e => setDispose(a.id, 'date', e.target.value)} />
                        <button className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50" onClick={() => dispose(a.id)} disabled={loading || a.status === 'DISPOSED'}>Céder</button>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center text-xs">
                        {editing ? (
                          <>
                            <button className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading} onClick={saveAssetEdit}>Sauver</button>
                            <button className="px-2 py-1 border rounded" onClick={() => { setAssetEditId(null); setAssetEditForm(null); }}>Annuler</button>
                          </>
                        ) : (
                          <>
                            <button className="px-2 py-1 border rounded" onClick={() => { const cat = categories.find(c => c.id === a.categoryId); setAssetEditId(a.id); setAssetEditForm({ ...a, usefulLifeMonths: cat?.durationMonths ?? a.usefulLifeMonths }); }}>Éditer</button>
                            <button className="px-2 py-1 border rounded text-red-700" onClick={() => deleteAsset(a.id)} disabled={loading}>Supprimer</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!assets.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">Aucune immobilisation pour l’instant.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
