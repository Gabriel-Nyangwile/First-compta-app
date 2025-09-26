import React from 'react';
import { listMoneyAccountsWithBalance, getMoneyAccountLedger } from '@/lib/serverActions/money';
import Amount from '@/components/Amount.jsx';
import NewMoneyMovementForm from '@/components/treasury/NewMoneyMovementForm.jsx';
import TransferForm from '@/components/treasury/TransferForm.jsx';
import NewMoneyAccountForm from '@/components/treasury/NewMoneyAccountForm.jsx';

export default async function TreasuryPage(props) {
  // Next.js App Router: searchParams is async in streaming contexts; defensively resolve if Promise-like
  const sp = await props.searchParams; // handles both plain object and promise
  const accountId = sp?.account || null;
  const q = (sp?.q || '').toLowerCase();
  const dateFrom = sp?.from || null;
  const dateTo = sp?.to || null;
  const limitParam = parseInt(sp?.limit || '200', 10);
  const accountsRaw = await listMoneyAccountsWithBalance();
  const accounts = accountsRaw.map(a => ({
    id: a.id,
    type: a.type,
    label: a.label,
    code: a.code,
    ledgerAccountId: a.ledgerAccountId,
    ledgerAccountNumber: a.ledgerAccount?.number || null,
    openingBalance: a.openingBalance?.toString?.() || a.openingBalance,
    computedBalance: a.computedBalance?.toString?.() || a.computedBalance,
    currency: a.currency,
    isActive: a.isActive
  }));
  let ledger = null;
  if (accountId) {
    ledger = await getMoneyAccountLedger({ moneyAccountId: accountId, limit: limitParam, dateFrom, dateTo });
    if (q) {
      ledger.movements = ledger.movements.filter(m =>
        (m.voucherRef && m.voucherRef.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.invoice?.number && m.invoice.number.toLowerCase().includes(q)) ||
        (m.incomingInvoice?.number && m.incomingInvoice.number.toLowerCase().includes(q))
      );
    }
  }
  return (
    <main className="u-main-container u-padding-content-container space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Trésorerie</h1>
        <p className="text-sm text-slate-600">Vue des comptes de trésorerie (caisse / banques) et derniers mouvements.</p>
      </div>
      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">Comptes</h2>
        <table className="w-full text-sm border-separate border-spacing-y-1">
          <thead>
            <tr className="text-left text-slate-600">
              <th>Label</th><th>Type</th><th>Compte comptable</th><th>Solde</th><th>Devise</th><th>Statut</th><th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="bg-slate-50 hover:bg-slate-100">
                <td className="px-2 py-1 font-medium">{a.label}</td>
                <td className="px-2 py-1">{a.type}</td>
                <td className="px-2 py-1 font-mono text-xs">{a.ledgerAccountNumber || '—'}</td>
                <td className="px-2 py-1 tabular-nums"><Amount value={a.computedBalance} currency={a.currency} /></td>
                <td className="px-2 py-1">{a.currency}</td>
                <td className="px-2 py-1">{a.isActive ? 'Actif' : 'Inactif'}</td>
                <td className="px-2 py-1"><a className="text-blue-600 underline" href={`/treasury?account=${a.id}`}>Voir</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid md:grid-cols-3 gap-6">
        <NewMoneyMovementForm accounts={accounts} />
        <TransferForm accounts={accounts} />
        <NewMoneyAccountForm />
      </div>
      {ledger && (
        <section className="bg-white border rounded p-4 space-y-4">
          <h2 className="font-semibold mb-2">Grand livre trésorerie</h2>
          <form className="flex flex-wrap gap-2 items-end text-xs" method="get">
            <input type="hidden" name="account" value={accountId} />
            <input type="hidden" name="limit" value={limitParam} />
            <div className="flex flex-col">
              <label className="text-slate-600">Du</label>
              <input type="date" name="from" defaultValue={dateFrom || ''} className="border px-2 py-1 rounded text-xs" />
            </div>
            <div className="flex flex-col">
              <label className="text-slate-600">Au</label>
              <input type="date" name="to" defaultValue={dateTo || ''} className="border px-2 py-1 rounded text-xs" />
            </div>
            <div className="flex flex-col">
              <label className="text-slate-600">Recherche</label>
              <input type="text" name="q" defaultValue={q} placeholder="Réf / desc / facture" className="border px-2 py-1 rounded text-xs" />
            </div>
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white px-3 py-1 rounded text-xs" type="submit">Filtrer</button>
              {(dateFrom || dateTo) && (
                <a href={`/treasury?account=${accountId}`} className="px-2 py-1 text-xs text-blue-700 underline">Réinitialiser</a>
              )}
            </div>
            {ledger.filter && (
              <div className="text-slate-500 text-xs ml-2">Filtre actif: {ledger.filter.from ? new Date(ledger.filter.from).toLocaleDateString() : 'début'} → {ledger.filter.to ? new Date(ledger.filter.to).toLocaleDateString() : 'fin'}</div>
            )}
          </form>
          {ledger && (
            <div className="flex flex-wrap gap-3 text-xs mt-1">
              <a
                href={`/api/treasury/ledger/export?account=${accountId}${dateFrom?`&from=${dateFrom}`:''}${dateTo?`&to=${dateTo}`:''}`}
                className="px-2 py-1 border rounded bg-slate-50 hover:bg-slate-100"
                target="_blank"
              >Export CSV</a>
              <a
                href={`/api/treasury/ledger/pdf?account=${accountId}${dateFrom?`&from=${dateFrom}`:''}${dateTo?`&to=${dateTo}`:''}`}
                className="px-2 py-1 border rounded bg-slate-50 hover:bg-slate-100"
                target="_blank"
              >PDF</a>
            </div>
          )}
          <div className="text-xs flex flex-wrap gap-6 text-slate-600">
            <span>Ouverture: <strong><Amount value={ledger.openingBalance} currency={ledger.currency || 'EUR'} /></strong></span>
            {ledger.filter && (
              <span>Ouverture initiale compte: <strong><Amount value={ledger.baseOpeningBalance} currency={ledger.currency || 'EUR'} /></strong></span>
            )}
            <span>Entrées: <strong className="text-green-700"><Amount value={ledger.totalIn} currency={ledger.currency || 'EUR'} /></strong></span>
            <span>Sorties: <strong className="text-red-700"><Amount value={ledger.totalOut} currency={ledger.currency || 'EUR'} /></strong></span>
            <span>Clôture: <strong><Amount value={ledger.closingBalance} currency={ledger.currency || 'EUR'} /></strong></span>
            {ledger.limited && <span className="text-amber-600">(affichage limité)</span>}
          </div>
          <table className="w-full text-xs border">
            <thead className="bg-slate-100">
              <tr className="text-left align-bottom">
                <th className="px-2 py-1">Date</th>
                <th className="px-2 py-1">Nature</th>
                <th className="px-2 py-1">Facture</th>
                <th className="px-2 py-1">Description</th>
                <th className="px-2 py-1">Réf</th>
                <th className="px-2 py-1">Compte (Débit)</th>
                <th className="px-2 py-1">Compte (Crédit)</th>
                <th className="px-2 py-1 text-right">Solde après</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50 font-medium">
                <td className="px-2 py-1" colSpan={7}>Solde d'ouverture</td>
                <td className="px-2 py-1 text-right tabular-nums"><Amount value={ledger.openingBalance} currency={ledger.currency || 'EUR'} /></td>
              </tr>
              {ledger.movements.map(m => {
                const debitLines = m.transactions.filter(t => t.debit).map(t => `${t.accountNumber} ${t.accountLabel}`);
                const creditLines = m.transactions.filter(t => t.credit).map(t => `${t.accountNumber} ${t.accountLabel}`);
                const debitAmounts = m.transactions.filter(t => t.debit).map(t => t.debit?.toString());
                const creditAmounts = m.transactions.filter(t => t.credit).map(t => t.credit?.toString());
                const maxRows = Math.max(debitLines.length, creditLines.length, 1);
                return (
                  <React.Fragment key={m.id}>
                    {[...Array(maxRows)].map((_, idx) => (
                      <tr key={m.id+':'+idx} className="border-t last:border-b-0 hover:bg-slate-50 align-top">
                        {idx===0 && (
                          <>
                            <td rowSpan={maxRows} className="px-2 py-1 font-mono whitespace-nowrap">{new Date(m.date).toLocaleDateString()}</td>
                            <td rowSpan={maxRows} className="px-2 py-1">{m.kind}</td>
                            <td rowSpan={maxRows} className="px-2 py-1 font-mono">{m.invoice?.number || m.incomingInvoice?.number || ''}</td>
                            <td rowSpan={maxRows} className="px-2 py-1 max-w-[180px] truncate" title={m.description}>{m.description}</td>
                            <td rowSpan={maxRows} className="px-2 py-1 font-mono text-[11px]" title={m.voucherRef}>{m.voucherRef}</td>
                          </>
                        )}
                        <td className="px-2 py-1">
                          {debitLines[idx] && (
                            <div className="flex justify-between gap-2">
                              <span className="font-mono truncate max-w-[110px]" title={debitLines[idx]}>{debitLines[idx]}</span>
                              <span className="tabular-nums text-green-700"><Amount value={debitAmounts[idx]} currency={ledger.currency || 'EUR'} /></span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {creditLines[idx] && (
                            <div className="flex justify-between gap-2">
                              <span className="font-mono truncate max-w-[110px]" title={creditLines[idx]}>{creditLines[idx]}</span>
                              <span className="tabular-nums text-red-700"><Amount value={creditAmounts[idx]} currency={ledger.currency || 'EUR'} /></span>
                            </div>
                          )}
                        </td>
                        {idx===0 && (
                          <td rowSpan={maxRows} className="px-2 py-1 tabular-nums text-right font-medium"><Amount value={m.balanceAfter} currency={ledger.currency || 'EUR'} /></td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              <tr className="bg-slate-100 font-semibold border-t">
                <td className="px-2 py-1" colSpan={5}>Totaux</td>
                <td className="px-2 py-1 tabular-nums text-green-700"><Amount value={ledger.totalIn} currency={ledger.currency || 'EUR'} /></td>
                <td className="px-2 py-1 tabular-nums text-red-700"><Amount value={ledger.totalOut} currency={ledger.currency || 'EUR'} /></td>
                <td className="px-2 py-1 tabular-nums text-right"><Amount value={ledger.closingBalance} currency={ledger.currency || 'EUR'} /></td>
              </tr>
            </tbody>
          </table>
          {ledger.limited && (
            <div className="mt-3">
              <a
                className="inline-block text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                href={`/treasury?account=${accountId}${dateFrom?`&from=${dateFrom}`:''}${dateTo?`&to=${dateTo}`:''}&limit=${limitParam+200}`}
              >Charger plus (+200)</a>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
