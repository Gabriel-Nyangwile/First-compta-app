"use client";
import { useState, useEffect } from 'react';
import AccountAutocomplete from '../AccountAutocomplete.jsx';
import Amount from '@/components/Amount.jsx';

export default function NewMoneyMovementForm({ accounts }) {
  const [moneyAccountId, setMoneyAccountId] = useState(accounts[0]?.id || '');
  const [direction, setDirection] = useState('IN');
  const [kind, setKind] = useState('OTHER');
  const [amount, setAmount] = useState(''); // Montant (utilisé hors CASH_PURCHASE ou auto-calculé)
  const [description, setDescription] = useState('');
  // voucherRef auto-généré côté serveur désormais
  const [voucherRef, setVoucherRef] = useState('');
  const [vatEnabled, setVatEnabled] = useState(true); // Par défaut on active la TVA pour un achat cash
  const [vatRate, setVatRate] = useState('0.20');
  const [htAmount, setHtAmount] = useState(''); // Montant HT principal pour CASH_PURCHASE
  const [counterAccount, setCounterAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  // Invoice selection (client or supplier)
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [searchingInvoices, setSearchingInvoices] = useState(false);
  const [invoiceResults, setInvoiceResults] = useState([]); // unified shape: {id, number, thirdPartyName, total, paid, remaining, kind: 'CLIENT'|'SUPPLIER'}
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSearchError, setInvoiceSearchError] = useState('');
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [justHadInsufficient, setJustHadInsufficient] = useState(false);
  const [prefillInvoiceId, setPrefillInvoiceId] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setOkMsg('');
    setJustHadInsufficient(false);
    if (!moneyAccountId) { setError('Sélectionner un compte de trésorerie'); return; }
    // Validation montant selon type
    if (kind === 'CASH_PURCHASE') {
      if (!htAmount || Number(htAmount) <= 0) { setError('Montant HT invalide'); return; }
    } else {
      if (!amount || Number(amount) <= 0) { setError('Montant invalide'); return; }
    }
    if (kind === 'CLIENT_RECEIPT' && direction !== 'IN') { setError('Encaissement client doit être une entrée'); return; }
    if (kind === 'SUPPLIER_PAYMENT' && direction !== 'OUT') { setError('Paiement fournisseur doit être une sortie'); return; }
    if (selectedInvoice) {
      // Force kind & direction coherence
      if (selectedInvoice.kind === 'CLIENT' && kind !== 'CLIENT_RECEIPT') { setError('Type mouvement incohérent avec facture client'); return; }
      if (selectedInvoice.kind === 'SUPPLIER' && kind !== 'SUPPLIER_PAYMENT') { setError('Type mouvement incohérent avec facture fournisseur'); return; }
    }
  if (kind === 'CASH_PURCHASE' && (!htAmount || Number(htAmount) <= 0)) { setError('Montant HT requis'); return; }
    if (!selectedInvoice && ['CASH_PURCHASE','VAT_PAYMENT','TAX_PAYMENT'].includes(kind) && !counterAccount) { setError('Compte contrepartie requis'); return; }

    // Calcul montant total pour CASH_PURCHASE
    let computedTotal = null;
    if (kind === 'CASH_PURCHASE') {
      const base = Number(htAmount);
      const rate = vatEnabled ? Number(vatRate) : 0;
      computedTotal = base + base * rate;
    }

    const payload = {
      moneyAccountId,
      amount: kind === 'CASH_PURCHASE' ? Number(computedTotal) : Number(amount),
      direction,
      kind,
      description: description || null,
      // on ne transmet plus voucherRef si vide: le serveur génèrera
      voucherRef: voucherRef.trim() || undefined,
      counterpartAccountId: selectedInvoice ? null : (counterAccount?.id || null),
    };
    if (selectedInvoice) {
      if (selectedInvoice.kind === 'CLIENT') payload.invoiceId = selectedInvoice.id;
      if (selectedInvoice.kind === 'SUPPLIER') payload.incomingInvoiceId = selectedInvoice.id;
    }
    if (kind === 'CASH_PURCHASE' && vatEnabled) {
      const base = Number(htAmount);
      const rate = Number(vatRate);
      payload.vatBreakdown = [{ rate, base }];
    }

    try {
      setLoading(true);
      const res = await fetch('/api/treasury/movements', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erreur serveur');
      setOkMsg('Mouvement créé');
  setAmount(''); setDescription(''); setHtAmount(''); setSelectedInvoice(null); setInvoiceQuery(''); setInvoiceResults([]); setVoucherRef('');
      window.location.href = `/treasury?account=${moneyAccountId}`; // simple refresh
    } catch(err) {
      setError(err.message);
      if (/solde caisse insuffisant/i.test(err.message)) {
        setJustHadInsufficient(true);
      }
    } finally {
      setLoading(false);
    }
  }

  // Invoice search effect (debounced)
  useEffect(() => {
    if (!invoiceQuery) { setInvoiceResults([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      try {
        setSearchingInvoices(true); setInvoiceSearchError('');
        const endpoints = [];
        if (kind === 'CLIENT_RECEIPT') endpoints.push(`/api/invoices/search-unpaid?query=${encodeURIComponent(invoiceQuery)}`);
        if (kind === 'SUPPLIER_PAYMENT') endpoints.push(`/api/incoming-invoices/search-unpaid?query=${encodeURIComponent(invoiceQuery)}`);
        if (!endpoints.length) { setSearchingInvoices(false); return; }
        const all = [];
        for (const ep of endpoints) {
          const res = await fetch(ep);
          if (!res.ok) throw new Error('Erreur API');
          const data = await res.json();
          for (const r of data) {
            all.push({
              id: r.id,
              number: r.entryNumber || r.invoiceNumber || r.supplierInvoiceNumber || '—',
              thirdPartyName: r.client?.name || r.supplier?.name || '—',
              total: Number(r.totalAmount),
              paid: Number(r.paid || 0),
              remaining: Number(r.remaining || 0),
              kind: kind === 'CLIENT_RECEIPT' ? 'CLIENT' : 'SUPPLIER'
            });
          }
        }
        if (active) setInvoiceResults(all);
      } catch(e) {
        if (active) setInvoiceSearchError(e.message);
      } finally {
        if (active) setSearchingInvoices(false);
      }
    }, 350);
    return () => { active = false; clearTimeout(t); };
  }, [invoiceQuery, kind]);

  // When selecting invoice, auto-fill amount with remaining
  useEffect(() => {
    if (selectedInvoice) {
  setAmount(selectedInvoice.remaining.toFixed(2)); // conserve champ input en string 2 décimales
    }
  }, [selectedInvoice]);

  // Reset invoice selection when kind changes
  useEffect(() => { setSelectedInvoice(null); setInvoiceQuery(''); setInvoiceResults([]); }, [kind]);
  // Auto-description par défaut selon la nature si champ vide
  useEffect(() => {
    const defaults = {
      ASSOCIATE_CONTRIBUTION: 'Apport associé',
      ASSOCIATE_WITHDRAWAL: 'Remboursement associé',
      SALARY_PAYMENT: 'Paiement salaires',
      SALARY_ADVANCE: 'Avance sur salaire'
    };
    if (defaults[kind] && !description) {
      setDescription(defaults[kind]);
    }
  }, [kind, description]);
  // Forçage direction côté client
  useEffect(() => {
    const forced = {
      CLIENT_RECEIPT: 'IN',
      SUPPLIER_PAYMENT: 'OUT',
      CASH_PURCHASE: 'OUT',
      ASSOCIATE_CONTRIBUTION: 'IN',
      ASSOCIATE_WITHDRAWAL: 'OUT',
      SALARY_PAYMENT: 'OUT',
      SALARY_ADVANCE: 'OUT'
    };
    if (forced[kind] && direction !== forced[kind]) setDirection(forced[kind]);
  }, [kind, direction]);

  // Clear error on key input changes
  useEffect(() => { if (error) setError(''); setJustHadInsufficient(false); }, [moneyAccountId, amount, htAmount, vatRate, direction, kind]);

  const selectedMoneyAccount = accounts.find(a => a.id === moneyAccountId);
  const currentBalance = selectedMoneyAccount ? Number(selectedMoneyAccount.computedBalance || 0) : 0;
  const isCash = selectedMoneyAccount?.type === 'CASH';
  const effectiveOutAmount = kind === 'CASH_PURCHASE'
    ? (() => { const base = Number(htAmount)||0; const rate = vatEnabled?Number(vatRate)||0:0; return base + base*rate; })()
    : Number(amount)||0;
  const willBeNegative = isCash && direction === 'OUT' && effectiveOutAmount > 0 && (currentBalance - effectiveOutAmount) < 0;

  function resetForm() {
    setKind('OTHER'); setDirection('IN'); setAmount(''); setDescription(''); setHtAmount(''); setVatRate('0.20'); setVatEnabled(true); setCounterAccount(null); setSelectedInvoice(null); setInvoiceQuery(''); setInvoiceResults([]); setError(''); setOkMsg(''); setJustHadInsufficient(false);
  }

  // Prefill invoice data from query params (quickInvoice / quickIncoming)
  useEffect(()=> {
    const params = new URLSearchParams(window.location.search);
    const qi = params.get('quickInvoice');
    const qs = params.get('quickIncoming');
    if (qi) {
      setKind('CLIENT_RECEIPT');
      // fetch single invoice unpaid data
      fetch(`/api/invoices/search-unpaid?query=${encodeURIComponent(qi)}`).then(r=>r.json()).then(list=>{
        const match = list.find(i=> i.id===qi);
        if (match) {
          const inv = {
            id: match.id,
            number: match.invoiceNumber || match.entryNumber || '—',
            thirdPartyName: match.client?.name || '—',
            total: Number(match.totalAmount),
            paid: Number(match.paid||0),
            remaining: Number(match.remaining||0),
            kind: 'CLIENT'
          };
          setSelectedInvoice(inv);
          setAmount(inv.remaining.toFixed(2));
          setPrefillInvoiceId(inv.id);
        }
      }).catch(()=>{});
    } else if (qs) {
      setKind('SUPPLIER_PAYMENT');
      fetch(`/api/incoming-invoices/search-unpaid?query=${encodeURIComponent(qs)}`).then(r=>r.json()).then(list=>{
        const match = list.find(i=> i.id===qs);
        if (match) {
          const inv = {
            id: match.id,
            number: match.entryNumber || match.supplierInvoiceNumber || '—',
            thirdPartyName: match.supplier?.name || '—',
            total: Number(match.totalAmount),
            paid: Number(match.paid||0),
            remaining: Number(match.remaining||0),
            kind: 'SUPPLIER'
          };
          setSelectedInvoice(inv);
          setAmount(inv.remaining.toFixed(2));
          setPrefillInvoiceId(inv.id);
        }
      }).catch(()=>{});
    }
  },[]);

  return (
  <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded p-6 max-w-5xl">
      <h3 className="font-semibold text-sm">Nouveau mouvement</h3>
      {selectedMoneyAccount && (
        <div className="text-xs text-slate-600 flex flex-wrap gap-4">
          <span>Compte sélectionné: <strong>{selectedMoneyAccount.label}</strong> ({selectedMoneyAccount.type})</span>
          <span>Solde actuel: <strong><Amount value={currentBalance} /></strong></span>
          {direction==='OUT' && effectiveOutAmount>0 && (
            <span>Solde après: <strong className={(willBeNegative?'text-red-600':'')}><Amount value={currentBalance - effectiveOutAmount} /></strong></span>
          )}
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <label className="flex flex-col">Compte trésorerie
          <select value={moneyAccountId} onChange={e=>setMoneyAccountId(e.target.value)} className="mt-1 border rounded px-2 py-1">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col">Sens
          {(['CLIENT_RECEIPT','SUPPLIER_PAYMENT','CASH_PURCHASE','ASSOCIATE_CONTRIBUTION','ASSOCIATE_WITHDRAWAL','SALARY_PAYMENT','SALARY_ADVANCE'].includes(kind)) ? (
            <div className="mt-1 px-2 py-1 border rounded bg-slate-100 text-xs font-medium flex items-center gap-2">
              <span>{direction === 'IN' ? 'Entrée (forcée)' : 'Sortie (forcée)'}</span>
              <span className="text-[10px] text-slate-500" title="Sens imposé par la nature du mouvement">ⓘ</span>
            </div>
          ) : (
            <select value={direction} onChange={e=>setDirection(e.target.value)} className="mt-1 border rounded px-2 py-1">
              <option value="IN">Entrée</option>
              <option value="OUT">Sortie</option>
            </select>
          )}
        </label>
        <label className="flex flex-col">Nature
          <select value={kind} onChange={e=>setKind(e.target.value)} className="mt-1 border rounded px-2 py-1 min-w-60">
            <optgroup label="Standard">
              <option value="OTHER">Autre</option>
              <option value="CLIENT_RECEIPT">Encaissement client</option>
              <option value="SUPPLIER_PAYMENT">Paiement fournisseur</option>
              <option value="CASH_PURCHASE">Achat cash</option>
              <option value="TRANSFER">Transfert (formulaire à droite)</option>
            </optgroup>
            <optgroup label="Fiscal & Taxes">
              <option value="VAT_PAYMENT">Paiement TVA</option>
              <option value="TAX_PAYMENT">Paiement taxe</option>
            </optgroup>
            <optgroup label="Associés / Salariés">
              <option value="ASSOCIATE_CONTRIBUTION">Apport associé</option>
              <option value="ASSOCIATE_WITHDRAWAL">Remboursement associé</option>
              <option value="SALARY_PAYMENT">Paiement salaires</option>
              <option value="SALARY_ADVANCE">Avance salaire</option>
            </optgroup>
          </select>
        </label>
      </div>
      {kind !== 'CASH_PURCHASE' && (
        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <label className="flex flex-col">Montant
            <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" step="0.01" className={`mt-1 border rounded px-2 py-1 ${willBeNegative ? 'border-red-500 bg-red-50' : ''}`} required />
            {willBeNegative && <span className="text-[10px] text-red-600 mt-1">Solde insuffisant (pré‑validation)</span>}
          </label>
          <label className="flex flex-col">Description
            <input value={description} onChange={e=>setDescription(e.target.value)} type="text" className="mt-1 border rounded px-2 py-1" />
          </label>
          <div className="flex flex-col text-[11px] text-slate-500">
            <span>Réf pièce</span>
            <span className="mt-1 px-2 py-1 border rounded bg-slate-50">Automatique</span>
          </div>
          {!selectedInvoice && ['CASH_PURCHASE','VAT_PAYMENT','TAX_PAYMENT','ASSOCIATE_CONTRIBUTION','ASSOCIATE_WITHDRAWAL','SALARY_PAYMENT','SALARY_ADVANCE'].includes(kind) && (
            <label className="flex flex-col">Compte contrepartie
              <AccountAutocomplete value={counterAccount} onChange={setCounterAccount} filterPrefix={['ASSOCIATE_CONTRIBUTION','ASSOCIATE_WITHDRAWAL','SALARY_PAYMENT','SALARY_ADVANCE'].includes(kind) ? '4' : undefined} />
              {['ASSOCIATE_CONTRIBUTION','ASSOCIATE_WITHDRAWAL','SALARY_PAYMENT','SALARY_ADVANCE'].includes(kind) && (
                <span className="text-[10px] text-slate-500 mt-1">Doit appartenir à la classe 4 (ex: 455, 421, 425...).</span>
              )}
            </label>
          )}
        </div>
      )}
      {kind === 'CASH_PURCHASE' && (
        <div className="space-y-2 text-sm">
          <div className="grid md:grid-cols-4 gap-3">
            <label className="flex flex-col">Montant HT
              <input value={htAmount} onChange={e=>setHtAmount(e.target.value)} type="number" step="0.01" className={`mt-1 border rounded px-2 py-1 ${willBeNegative ? 'border-red-500 bg-red-50' : ''}`} required />
            </label>
            <label className="flex flex-col">Taux TVA
              <input value={vatRate} disabled={!vatEnabled} onChange={e=>setVatRate(e.target.value)} type="number" step="0.01" className="mt-1 border rounded px-2 py-1" />
            </label>
            <label className="flex flex-col">Description
              <input value={description} onChange={e=>setDescription(e.target.value)} type="text" className="mt-1 border rounded px-2 py-1" />
            </label>
            <div className="flex flex-col text-[11px] text-slate-500">
              <span>Réf pièce</span>
              <span className="mt-1 px-2 py-1 border rounded bg-slate-50">Automatique</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={vatEnabled} onChange={e=>setVatEnabled(e.target.checked)} /> TVA
            </label>
            {htAmount && (
              (() => {
                const base = Number(htAmount)||0; const rate = vatEnabled?Number(vatRate)||0:0; const vat = base*rate; const total=base+vat; return (
                  <span>Total TTC calculé: <strong><Amount value={total} /></strong> (TVA <Amount value={vat} />)</span>
                );
              })()
            )}
          </div>
          {!selectedInvoice && (
            <div className="text-xs">
              <label className="flex flex-col">Compte contrepartie
                <AccountAutocomplete value={counterAccount} onChange={setCounterAccount} filterPrefix={['ASSOCIATE_CONTRIBUTION','ASSOCIATE_WITHDRAWAL','SALARY_PAYMENT','SALARY_ADVANCE'].includes(kind) ? '4' : undefined} />
                {['ASSOCIATE_CONTRIBUTION','ASSOCIATE_WITHDRAWAL','SALARY_PAYMENT','SALARY_ADVANCE'].includes(kind) && (
                  <span className="text-[10px] text-slate-500 mt-1">Classe 4 uniquement (contrôle serveur).</span>
                )}
              </label>
            </div>
          )}
        </div>
      )}
      {(kind === 'CLIENT_RECEIPT' || kind === 'SUPPLIER_PAYMENT') && (
        <div className="border rounded p-3 bg-slate-50 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={invoiceQuery}
              onChange={e=>setInvoiceQuery(e.target.value)}
              placeholder={kind==='CLIENT_RECEIPT' ? 'Chercher facture client...' : 'Chercher facture fournisseur...'}
              className="flex-1 border rounded px-2 py-1"
            />
            {selectedInvoice && (
              <button type="button" onClick={()=>setSelectedInvoice(null)} className="text-xs text-blue-600 underline">Réinitialiser</button>
            )}
          </div>
          {invoiceSearchError && <div className="text-red-600 text-xs">{invoiceSearchError}</div>}
          {selectedInvoice ? (
            <div className="text-xs text-green-700 flex flex-wrap gap-3">
              <span>Facture sélectionnée: {selectedInvoice.number}</span>
              <span>Tiers: {selectedInvoice.thirdPartyName}</span>
              <span>Total: <Amount value={selectedInvoice.total} /></span>
              <span>Payé: <Amount value={selectedInvoice.paid} /></span>
              <span>Reste: <Amount value={selectedInvoice.remaining} /></span>
            </div>
          ) : (
            <div className="max-h-40 overflow-auto divide-y border rounded bg-white">
              {searchingInvoices && <div className="p-2 text-xs text-slate-500">Recherche...</div>}
              {!searchingInvoices && invoiceQuery && invoiceResults.length === 0 && <div className="p-2 text-xs text-slate-500">Aucun résultat</div>}
              {invoiceResults.map(inv => (
                <button type="button" key={inv.id} onClick={()=>setSelectedInvoice(inv)} className="w-full text-left px-2 py-1 hover:bg-blue-50 text-xs">
                  <span className="font-mono">{inv.number}</span> — {inv.thirdPartyName} — Total <Amount value={inv.total} /> — Payé <Amount value={inv.paid} /> — Reste <Amount value={inv.remaining} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {justHadInsufficient && !willBeNegative && <div className="text-xs text-amber-600">Le solde a peut-être changé entre temps. Réessayez.</div>}
      {okMsg && <div className="text-green-600 text-sm">{okMsg}</div>}
      <div className="flex gap-2">
        <button disabled={loading || willBeNegative} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50" type="submit">{loading? 'En cours...' : 'Créer'}</button>
        <button type="button" onClick={resetForm} className="px-3 py-2 text-sm border rounded hover:bg-slate-50">Réinitialiser</button>
        <a href={selectedMoneyAccount?`/treasury?account=${selectedMoneyAccount.id}`:'/treasury'} className="px-3 py-2 text-sm border rounded hover:bg-slate-50">Rafraîchir solde</a>
      </div>
    </form>
  );
}
