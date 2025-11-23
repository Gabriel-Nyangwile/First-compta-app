"use client";
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const buttonBase = 'px-2 py-1 text-xs rounded border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50';
function ActionButton({ children, onClick, variant='primary' }) {
  const styles = variant==='danger'
    ? `${buttonBase} bg-red-50 hover:bg-red-100 border-red-300 text-red-700`
    : variant==='neutral'
      ? `${buttonBase} bg-white hover:bg-gray-50 border-gray-300 text-gray-700`
      : `${buttonBase} bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700`;
  return <button type="button" onClick={onClick} className={styles}>{children}</button>;
}

async function postJSON(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putJSON(url, body) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function del(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type='info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(()=>setToasts(t => t.filter(x=>x.id!==id)), 4200);
  }, []);
  return { toasts, push };
}

function Toasts({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-xs">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`text-xs px-3 py-2 rounded shadow-sm border bg-white flex items-start gap-2 ${t.type==='error'?'border-red-400 text-red-700':'border-gray-300 text-gray-800'}`}
        >
          {t.type==='error' ? '⚠️' : '✅'} <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function validateBrackets(raw, push) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch(e){ push('Brackets JSON invalide (parse)', 'error'); return null; }
  if (!Array.isArray(parsed)) { push('Brackets doit être un tableau []', 'error'); return null; }
  for (let i=0;i<parsed.length;i++) {
    const b = parsed[i];
    if (typeof b !== 'object' || b === null) return push(`Bracket index ${i} non objet`, 'error'), null;
    if (!('upTo' in b) || !('rate' in b)) return push(`Bracket ${i} manque upTo/rate`, 'error'), null;
    if (typeof b.upTo !== 'number' || isNaN(b.upTo)) return push(`Bracket ${i} upTo non numérique`, 'error'), null;
    if (typeof b.rate !== 'number' || isNaN(b.rate)) return push(`Bracket ${i} rate non numérique`, 'error'), null;
  }
  return parsed;
}

const inputBase = 'px-2 py-1 border text-xs rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400';

function Hint({ text }) {
  return <span className="ml-1 align-middle cursor-help text-gray-400" title={text}>ⓘ</span>;
}

function ContributionSchemeForm({ pushToast }) {
  const r = useRouter();
  const [form, setForm] = useState({ code:'', label:'', employeeRate:'', employerRate:'', ceiling:'', baseKind:'BRUT' });
  const [loading, setLoading] = useState(false);
  async function submit(e){
    e.preventDefault();
    setLoading(true);
    try {
      await postJSON('/api/payroll/contribution-schemes', { ...form, employeeRate: Number(form.employeeRate), employerRate: Number(form.employerRate), ceiling: form.ceiling?Number(form.ceiling):null });
      setForm({ code:'', label:'', employeeRate:'', employerRate:'', ceiling:'', baseKind:'BRUT' });
      pushToast('Scheme ajouté');
      r.refresh();
    } catch(err){ pushToast(err.message||'Erreur ajout scheme','error'); } finally { setLoading(false); }
  }
  return (
    <>
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-end mb-1 bg-gray-50/50 p-2 rounded">
        <div className="flex items-center"><input placeholder="Code" value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className={inputBase} required /><Hint text="Code unique; regex A-Z0-9[-_] max 32 caractères"/></div>
        <div className="flex items-center"><input placeholder="Label" value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} className={inputBase} required /><Hint text="Label ≤ 120 caractères"/></div>
        <div className="flex items-center"><input placeholder="Emp Rate" value={form.employeeRate} onChange={e=>setForm(f=>({...f, employeeRate:e.target.value}))} className={`${inputBase} w-24`} required /><Hint text="Taux salarié décimal 0..1 (7% = 0.07)"/></div>
        <div className="flex items-center"><input placeholder="Empl Rate" value={form.employerRate} onChange={e=>setForm(f=>({...f, employerRate:e.target.value}))} className={`${inputBase} w-24`} required /><Hint text="Taux employeur décimal 0..1"/></div>
        <div className="flex items-center"><input placeholder="Ceiling" value={form.ceiling} onChange={e=>setForm(f=>({...f, ceiling:e.target.value}))} className={`${inputBase} w-28`} /><Hint text="Optionnel: plafond > 0 sinon laisser vide"/></div>
        <select value={form.baseKind} onChange={e=>setForm(f=>({...f, baseKind:e.target.value}))} className={inputBase}>
          <option value="BASE_SALAIRE">BASE_SALAIRE</option>
          <option value="BRUT">BRUT</option>
          <option value="IMPOSABLE">IMPOSABLE</option>
        </select>
        <Hint text="Base de calcul: BASE_SALAIRE / BRUT / IMPOSABLE"/>
        <button disabled={loading} className="px-3 py-1 text-xs rounded bg-green-500 hover:bg-green-600 text-white font-medium disabled:opacity-50">{loading?'...':'Ajouter'}</button>
      </form>
      <p className="mb-3 text-[10px] text-gray-600">Aide: Taux décimaux [0,1]; plafond &gt; 0 si présent; baseKind: BASE_SALAIRE/BRUT/IMPOSABLE. Réf <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README 18.8</a> · <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.</p>
    </>
  );
}

function ContributionSchemeRow({ scheme, pushToast }) {
  const r = useRouter();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ ...scheme, employeeRate: scheme.employeeRate.toString(), employerRate: scheme.employerRate.toString(), ceiling: scheme.ceiling?.toString()||'', active: scheme.active });
  async function save(){
    try {
      await putJSON(`/api/payroll/contribution-schemes/${scheme.id}`, { ...form, employeeRate:Number(form.employeeRate), employerRate:Number(form.employerRate), ceiling: form.ceiling?Number(form.ceiling):null });
      setEdit(false); r.refresh(); pushToast('Scheme sauvegardé');
    } catch(e){ pushToast(e.message||'Erreur sauvegarde scheme','error'); }
  }
  async function remove(){ if(!confirm('Supprimer ce scheme ?')) return; try { await del(`/api/payroll/contribution-schemes/${scheme.id}`); r.refresh(); pushToast('Scheme supprimé'); } catch(e){ pushToast(e.message||'Erreur suppression','error'); } }
  return (
    <tr className="border-t odd:bg-white even:bg-gray-50 hover:bg-yellow-50 transition-colors">
      <td className="px-2 py-1">{edit? <input value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className="border px-1 py-0.5 text-xs"/> : scheme.code}</td>
      <td className="px-2 py-1">{edit? <input value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} className="border px-1 py-0.5 text-xs"/> : scheme.label}</td>
      <td className="px-2 py-1">{edit? <input value={form.employeeRate} onChange={e=>setForm(f=>({...f, employeeRate:e.target.value}))} className="border w-16 px-1 py-0.5 text-xs"/> : scheme.employeeRate.toString()}</td>
      <td className="px-2 py-1">{edit? <input value={form.employerRate} onChange={e=>setForm(f=>({...f, employerRate:e.target.value}))} className="border w-16 px-1 py-0.5 text-xs"/> : scheme.employerRate.toString()}</td>
      <td className="px-2 py-1">{edit? <input value={form.ceiling} onChange={e=>setForm(f=>({...f, ceiling:e.target.value}))} className="border w-20 px-1 py-0.5 text-xs"/> : (scheme.ceiling?.toString()||'—')}</td>
      <td className="px-2 py-1">{edit? <select value={form.baseKind} onChange={e=>setForm(f=>({...f, baseKind:e.target.value}))} className="border text-xs"><option value="BASE_SALAIRE">BASE_SALAIRE</option><option value="BRUT">BRUT</option><option value="IMPOSABLE">IMPOSABLE</option></select> : scheme.baseKind}</td>
      <td className="px-2 py-1">{edit? <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f, active:e.target.checked}))}/> : (scheme.active? '✔':'✖')}</td>
      <td className="px-2 py-1 flex gap-2">{edit? <ActionButton onClick={save}>Save</ActionButton> : <ActionButton onClick={()=>setEdit(true)}>Edit</ActionButton>}<ActionButton variant="danger" onClick={remove}>Del</ActionButton></td>
    </tr>
  );
}

function TaxRuleForm({ pushToast }){
  const r = useRouter();
  const [form,setForm] = useState({ code:'', label:'', brackets:'[]', roundingMode:'BANKERS' });
  const [loading,setLoading] = useState(false);
  async function submit(e){
    e.preventDefault(); setLoading(true);
    const parsed = validateBrackets(form.brackets, pushToast);
    if (!parsed) { setLoading(false); return; }
    try { await postJSON('/api/payroll/tax-rules', { ...form }); setForm({ code:'', label:'', brackets:'[]', roundingMode:'BANKERS' }); r.refresh(); pushToast('Tax rule ajoutée'); } catch(err){ pushToast(err.message||'Erreur ajout tax rule','error'); } finally { setLoading(false); }
  }
  return (
    <>
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-end mb-1 bg-gray-50/50 p-2 rounded">
        <div className="flex items-center"><input placeholder="Code" value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className={inputBase} required /><Hint text="Code unique; regex A-Z0-9[-_]"/></div>
        <div className="flex items-center"><input placeholder="Label" value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} className={inputBase} required /><Hint text="Label ≤ 160 caractères"/></div>
        <div className="flex items-center"><input placeholder="Brackets JSON" value={form.brackets} onChange={e=>setForm(f=>({...f, brackets:e.target.value}))} className={`${inputBase} w-64 font-mono`} required /><Hint text="JSON array ascendant: [{upTo,rate}] upTo>0 rate 0..1"/></div>
        <select value={form.roundingMode} onChange={e=>setForm(f=>({...f, roundingMode:e.target.value}))} className={inputBase}>
          <option value="NONE">NONE</option>
          <option value="BANKERS">BANKERS</option>
          <option value="UP">UP</option>
          <option value="DOWN">DOWN</option>
        </select>
        <Hint text="Arrondi final: NONE / BANKERS / UP / DOWN"/>
        <button disabled={loading} className="px-3 py-1 text-xs rounded bg-green-500 hover:bg-green-600 text-white font-medium disabled:opacity-50">{loading?'...':'Add'}</button>
      </form>
      <p className="mb-3 text-[10px] text-gray-600">Aide: brackets ascendants <code>[&#123;upTo:n, rate:r&#125;]</code> (rate 0..1). Sentinelle haute autorisée. Arrondi: NONE/BANKERS/UP/DOWN. Réf <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README 18.8</a> · <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.</p>
    </>
  );
}

function TaxRuleRow({ rule, pushToast }){
  const r = useRouter();
  const [edit,setEdit] = useState(false);
  const [form,setForm] = useState({ ...rule, brackets: JSON.stringify(rule.brackets), active: rule.active });
  async function save(){
    const parsed = validateBrackets(form.brackets, pushToast);
    if (!parsed) return;
    try { await putJSON(`/api/payroll/tax-rules/${rule.id}`, form); setEdit(false); r.refresh(); pushToast('Tax rule sauvegardée'); } catch(e){ pushToast(e.message||'Erreur sauvegarde tax rule','error'); }
  }
  async function remove(){ if(!confirm('Delete tax rule?')) return; try { await del(`/api/payroll/tax-rules/${rule.id}`); r.refresh(); pushToast('Tax rule supprimée'); } catch(e){ pushToast(e.message||'Erreur suppression tax rule','error'); } }
  return (
    <tr className="border-t odd:bg-white even:bg-gray-50 hover:bg-yellow-50 transition-colors">
      <td className="px-2 py-1">{edit? <input value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className="border px-1 py-0.5 text-xs"/> : rule.code}</td>
      <td className="px-2 py-1">{edit? <input value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} className="border px-1 py-0.5 text-xs"/> : rule.label}</td>
      <td className="px-2 py-1">{rule.brackets.length}</td>
      <td className="px-2 py-1">{edit? <select value={form.roundingMode} onChange={e=>setForm(f=>({...f, roundingMode:e.target.value}))} className="border text-xs"><option value="NONE">NONE</option><option value="BANKERS">BANKERS</option><option value="UP">UP</option><option value="DOWN">DOWN</option></select> : rule.roundingMode}</td>
      <td className="px-2 py-1">{edit? <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f, active:e.target.checked}))}/> : (rule.active? '✔':'✖')}</td>
      <td className="px-2 py-1 flex gap-2">{edit? <ActionButton onClick={save}>Save</ActionButton> : <ActionButton onClick={()=>setEdit(true)}>Edit</ActionButton>}<ActionButton variant="danger" onClick={remove}>Del</ActionButton></td>
    </tr>
  );
}

function CostCenterForm({ pushToast }){
  const r = useRouter();
  const [form,setForm] = useState({ code:'', label:'', active:true });
  const [loading,setLoading] = useState(false);
  async function submit(e){ e.preventDefault(); setLoading(true); try { await postJSON('/api/payroll/cost-centers', form); setForm({ code:'', label:'', active:true }); r.refresh(); pushToast('Cost center ajouté'); } catch(err){ pushToast(err.message||'Erreur ajout cost center','error'); } finally { setLoading(false); } }
  return (
    <>
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-end mb-1 bg-gray-50/50 p-2 rounded">
        <div className="flex items-center"><input placeholder="Code" value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className={inputBase} required /><Hint text="Code unique; regex A-Z0-9[-_]"/></div>
        <div className="flex items-center"><input placeholder="Label" value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} className={inputBase} required /><Hint text="Label ≤ 120 caractères"/></div>
        <label className="flex items-center gap-1 text-xs select-none"><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f, active:e.target.checked}))} className="rounded border-gray-300"/> Active</label>
        <button disabled={loading} className="px-3 py-1 text-xs rounded bg-green-500 hover:bg-green-600 text-white font-medium disabled:opacity-50">{loading?'...':'Add'}</button>
      </form>
      <p className="mb-3 text-[10px] text-gray-600">Aide: code unique (regex), label ≤120 chars. Désactiver au lieu de supprimer si référencé. Réf <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README 18.8</a> · <a className="underline" href="https://github.com/Gabriel-Nyangwile/first-compta/blob/master/docs/payroll-validation.md" target="_blank" rel="noopener noreferrer">Cheat Sheet</a>.</p>
    </>
  );
}

function CostCenterRow({ center, pushToast }){
  const r = useRouter();
  const [edit,setEdit] = useState(false);
  const [form,setForm] = useState({ ...center });
  async function save(){ try { await putJSON(`/api/payroll/cost-centers/${center.id}`, form); setEdit(false); r.refresh(); pushToast('Cost center sauvegardé'); } catch(e){ pushToast(e.message||'Erreur sauvegarde cost center','error'); } }
  async function remove(){ if(!confirm('Delete cost center?')) return; try { await del(`/api/payroll/cost-centers/${center.id}`); r.refresh(); pushToast('Cost center supprimé'); } catch(e){ pushToast(e.message||'Erreur suppression cost center','error'); } }
  return (
    <tr className="border-t odd:bg-white even:bg-gray-50 hover:bg-yellow-50 transition-colors">
      <td className="px-2 py-1">{edit? <input value={form.code} onChange={e=>setForm(f=>({...f, code:e.target.value}))} className="border px-1 py-0.5 text-xs"/> : center.code}</td>
      <td className="px-2 py-1">{edit? <input value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} className="border px-1 py-0.5 text-xs"/> : center.label}</td>
      <td className="px-2 py-1">{edit? <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f, active:e.target.checked}))}/> : (center.active? '✔':'✖')}</td>
      <td className="px-2 py-1 flex gap-2">{edit? <ActionButton onClick={save}>Save</ActionButton> : <ActionButton onClick={()=>setEdit(true)}>Edit</ActionButton>}<ActionButton variant="danger" onClick={remove}>Del</ActionButton></td>
    </tr>
  );
}

export default function ClientTables({ schemes, rules, centers, loadError = null }) {
  const { toasts, push } = useToasts();
  const [data, setData] = useState({ schemes, rules, centers });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(loadError);

  async function refreshAll() {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/payroll/config', { cache: 'no-store' });
      if (!res.ok) throw new Error('Erreur serveur');
      const json = await res.json();
      setData({
        schemes: json.contributionSchemes || [],
        rules: json.taxRules || [],
        centers: json.costCenters || []
      });
      push('Configuration rechargée');
    } catch (e) {
      setError(e.message || 'Échec recharge');
      push(e.message || 'Échec recharge', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toasts toasts={toasts} />
      <aside className="mb-4 text-[11px] leading-relaxed bg-blue-50 border border-blue-200 text-blue-800 rounded p-2 max-w-prose">
        <strong>Validation Reference:</strong> Server-side error codes & rules are documented in
        {' '}<a className="underline hover:no-underline" href="https://github.com/Gabriel-Nyangwile/first-compta#188-validation-rules" target="_blank" rel="noopener noreferrer">README §18.8</a>
        {' '}(EN) and
        {' '}<a className="underline hover:no-underline" href="https://github.com/Gabriel-Nyangwile/first-compta#1518-règles-de-validation" target="_blank" rel="noopener noreferrer">README.fr §15.1.8</a>.
        {' '}Concise cheat sheet: <code>/docs/payroll-validation.md</code>.
        Rates must be decimals in [0,1]; brackets strictly ascending; duplicate <code>code</code> returns <code>code.exists</code>.
        <div className="mt-2 flex items-center gap-2">
          <ActionButton variant="neutral" onClick={refreshAll}>{loading ? '...' : 'Recharger'}</ActionButton>
          {error && <span className="text-red-700 text-xs">{error}</span>}
        </div>
      </aside>
      <section className="space-y-2">
        <h2 className="font-medium text-lg">Contribution Schemes</h2>
        <ContributionSchemeForm pushToast={push} />
        <div className="overflow-x-auto border rounded bg-white shadow-sm">
        <table className="text-sm min-w-[760px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
              <th className="px-2 py-1 text-left">Code</th>
              <th className="px-2 py-1 text-left">Label</th>
              <th className="px-2 py-1 text-left">EmpR</th>
              <th className="px-2 py-1 text-left">EmplR</th>
              <th className="px-2 py-1 text-left">Ceiling</th>
              <th className="px-2 py-1 text-left">BaseKind</th>
              <th className="px-2 py-1 text-left">Active</th>
              <th className="px-2 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.schemes.map(s => <ContributionSchemeRow key={s.id} scheme={s} pushToast={push} />)}
          </tbody>
        </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-lg">Tax Rules</h2>
        <TaxRuleForm pushToast={push} />
        <div className="overflow-x-auto border rounded bg-white shadow-sm">
        <table className="text-sm min-w-[760px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
              <th className="px-2 py-1 text-left">Code</th>
              <th className="px-2 py-1 text-left">Label</th>
              <th className="px-2 py-1 text-left">Brackets count</th>
              <th className="px-2 py-1 text-left">Rounding</th>
              <th className="px-2 py-1 text-left">Active</th>
              <th className="px-2 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.rules.map(r => <TaxRuleRow key={r.id} rule={r} pushToast={push} />)}
          </tbody>
        </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-lg">Cost Centers</h2>
        <CostCenterForm pushToast={push} />
        <div className="overflow-x-auto border rounded bg-white shadow-sm">
        <table className="text-sm min-w-[640px] w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
              <th className="px-2 py-1 text-left">Code</th>
              <th className="px-2 py-1 text-left">Label</th>
              <th className="px-2 py-1 text-left">Active</th>
              <th className="px-2 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.centers.map(c => <CostCenterRow key={c.id} center={c} pushToast={push} />)}
          </tbody>
        </table>
        </div>
      </section>
    </>
  );
}
