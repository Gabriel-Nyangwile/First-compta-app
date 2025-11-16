'use client';
import React from 'react';

export default function InvoiceLinker() {
  const [mode, setMode] = React.useState('NONE'); // NONE | CLIENT | SUPPLIER
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState([]); // {id, number, remaining, total}
  const [selected, setSelected] = React.useState(null);
  const [touched, setTouched] = React.useState(false); // user interacted
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!query || mode==='NONE') { setResults([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      try {
        setLoading(true); setError('');
        const ep = mode === 'CLIENT'
          ? `/api/invoices/search-unpaid?query=${encodeURIComponent(query)}`
          : `/api/incoming-invoices/search-unpaid?query=${encodeURIComponent(query)}`;
        const res = await fetch(ep);
        if (!res.ok) throw new Error('Erreur API');
        const data = await res.json();
        const mapped = data.map(r => ({
          id: r.id,
          number: r.invoiceNumber || r.entryNumber || r.supplierInvoiceNumber || r.clientInvoiceNumber || '—',
          total: Number(r.totalAmount || r.total || 0),
          paid: Number(r.paid || 0),
          remaining: Number(r.remaining || Number(r.outstandingAmount||0) || 0)
        }));
        if (active) setResults(mapped);
      } catch(e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [query, mode]);

  const hiddenInputs = selected ? (
    mode === 'CLIENT'
      ? <input type="hidden" name="invoiceId" value={selected.id} />
      : <input type="hidden" name="incomingInvoiceId" value={selected.id} />
  ) : null;

  const requireSelection = touched && mode !== 'NONE' && !selected;

  return (
    <div className="border rounded p-3 space-y-2 bg-slate-50">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Lier facture</span>
        <select value={mode} onChange={e=>{ setMode(e.target.value); setSelected(null); setQuery(''); setTouched(true); }} className="border rounded px-2 py-1">
          <option value="NONE">(Aucune)</option>
          <option value="CLIENT">Facture client</option>
          <option value="SUPPLIER">Facture fournisseur</option>
        </select>
        {mode !== 'NONE' && <span className="text-[10px] text-slate-500">Doit être une facture non soldée.</span>}
      </div>
      {mode !== 'NONE' && (
        <div className="space-y-2">
          <input
            value={query}
            onChange={e=>{ setQuery(e.target.value); setTouched(true); }}
            placeholder={mode==='CLIENT' ? 'Chercher facture client...' : 'Chercher facture fournisseur...'}
            className="w-full border rounded px-2 py-1 text-xs"
          />
          {loading && <div className="text-[11px] text-slate-500">Recherche...</div>}
          {error && <div className="text-[11px] text-red-600">{error}</div>}
          {!loading && query && results.length===0 && <div className="text-[11px] text-slate-500">Aucun résultat</div>}
          {results.length>0 && (
            <div className="max-h-44 overflow-auto divide-y border rounded bg-white">
              {results.map(r => (
                <button type="button" key={r.id} onClick={()=>setSelected(r)} className={`w-full text-left px-2 py-1 hover:bg-blue-50 text-[11px] ${selected?.id===r.id?'bg-blue-100':''}`}>
                  <span className="font-mono">{r.number}</span> — Reste {r.remaining.toFixed(2)} / {r.total.toFixed(2)}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="text-[11px] text-green-700 flex flex-wrap gap-2 items-center">
              <span>Sélection: <strong>{selected.number}</strong></span>
              <button type="button" onClick={()=>setSelected(null)} className="underline text-blue-600">Changer</button>
            </div>
          )}
          {requireSelection && <div className="text-[11px] text-red-600">Une facture doit être sélectionnée ou remettre "(Aucune)".</div>}
        </div>
      )}
      {hiddenInputs}
    </div>
  );
}
