'use client';
import React from 'react';
import AccountAutocomplete from '@/components/AccountAutocomplete';

const OTHER_ACCOUNT_MODES = new Set(['OTHER_ASSET', 'OTHER_PASSIVE']);
const OTHER_ACCOUNT_PREFIXES = {
  OTHER_ASSET: ['2', '3', '4'],
  OTHER_PASSIVE: ['1', '4'],
};
const OTHER_ACCOUNT_HELP = {
  OTHER_ASSET: 'Comptes actifs ou débiteurs : immobilisations, stocks, autres débiteurs (ex. 471100).',
  OTHER_PASSIVE: 'Comptes passifs ou créditeurs : ressources, dettes, autres créditeurs (ex. 471200).',
};

export default function InvoiceLinker({ flow = null }) {
  const [mode, setMode] = React.useState('NONE'); // NONE | CLIENT | SUPPLIER | OTHER_ASSET | OTHER_PASSIVE
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState([]); // {id, number, remaining, total}
  const [selected, setSelected] = React.useState(null);
  const [selectedAccount, setSelectedAccount] = React.useState(null);
  const [touched, setTouched] = React.useState(false); // user interacted
  const [error, setError] = React.useState('');
  const isOtherAccountMode = OTHER_ACCOUNT_MODES.has(mode);

  React.useEffect(() => {
    if (!query || mode==='NONE' || isOtherAccountMode) { setResults([]); return; }
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
  }, [query, mode, isOtherAccountMode]);

  let hiddenInputs = null;
  if (selected) {
    hiddenInputs = mode === 'CLIENT'
      ? <input type="hidden" name="invoiceId" value={selected.id} />
      : <input type="hidden" name="incomingInvoiceId" value={selected.id} />;
  } else if (isOtherAccountMode && selectedAccount?.id) {
    hiddenInputs = (
      <>
        <input type="hidden" name="beneficiaryType" value="OTHER" />
        <input type="hidden" name="beneficiaryAccountNature" value={mode} />
        <input type="hidden" name="beneficiaryAccountId" value={selectedAccount.id} />
      </>
    );
  }

  const requireSelection =
    touched &&
    mode !== 'NONE' &&
    ((isOtherAccountMode && !selectedAccount) || (!isOtherAccountMode && !selected));

  return (
    <div className="border rounded p-3 space-y-2 bg-slate-50">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Lier à</span>
        <select
          value={mode}
          onChange={e=>{
            setMode(e.target.value);
            setSelected(null);
            setSelectedAccount(null);
            setQuery('');
            setTouched(true);
          }}
          className="border rounded px-2 py-1"
        >
          <option value="NONE">(Aucune)</option>
          <option value="CLIENT">Facture client</option>
          <option value="SUPPLIER">Facture fournisseur</option>
          <option value="OTHER_ASSET">Autre actif</option>
          <option value="OTHER_PASSIVE">Autre passif</option>
        </select>
        {mode !== 'NONE' && !isOtherAccountMode && <span className="text-[10px] text-slate-500">Doit être une facture non soldée.</span>}
        {isOtherAccountMode && <span className="text-[10px] text-slate-500">{flow === 'IN' ? 'Encaissement' : flow === 'OUT' ? 'Décaissement' : 'Mouvement'} sur compte générique.</span>}
      </div>
      {isOtherAccountMode && (
        <div className="space-y-2">
          <AccountAutocomplete
            value={selectedAccount}
            onChange={setSelectedAccount}
            filterPrefixes={OTHER_ACCOUNT_PREFIXES[mode]}
            placeholder={mode === 'OTHER_ASSET' ? 'Compte actif ou débiteur' : 'Compte passif ou créditeur'}
          />
          <p className="text-[11px] text-slate-500 leading-snug">{OTHER_ACCOUNT_HELP[mode]}</p>
          {selectedAccount && (
            <div className="text-[11px] text-green-700">
              Compte sélectionné : <strong>{selectedAccount.number}</strong> - {selectedAccount.label}
            </div>
          )}
          {requireSelection && <div className="text-[11px] text-red-600">Sélectionnez un compte ou remettre "(Aucune)".</div>}
        </div>
      )}
      {mode !== 'NONE' && !isOtherAccountMode && (
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
