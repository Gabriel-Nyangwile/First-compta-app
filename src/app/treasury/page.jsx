import React from 'react';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { listMoneyAccountsWithBalance, getMoneyAccountLedger, getMissionAdvanceOverview } from '@/lib/serverActions/money';
import { getCompanyIdFromCookies } from '@/lib/tenant';
import { getCompanyCurrency } from '@/lib/companyContext';
import Amount from '@/components/Amount.jsx';
import { formatAmount } from '@/lib/utils';
import TreasuryModuleNav from '@/components/treasury/TreasuryModuleNav.jsx';
import NewMoneyMovementForm from '@/components/treasury/NewMoneyMovementForm.jsx';
import TransferForm from '@/components/treasury/TransferForm.jsx';
import NewMoneyAccountForm from '@/components/treasury/NewMoneyAccountForm.jsx';
import MissionAdvanceRegularizationForm from '@/components/treasury/MissionAdvanceRegularizationForm.jsx';
import MissionAdvanceOpenPanel from '@/components/treasury/MissionAdvanceOpenPanel.jsx';
import MissionAdvanceRefundForm from '@/components/treasury/MissionAdvanceRefundForm.jsx';

export default async function TreasuryPage(props) {
  const sp = await props.searchParams;
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) {
    return (
      <main className="u-main-container u-padding-content-container">
        companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).
      </main>
    );
  }
  const accountId = sp?.account || null;
  const q = (sp?.q || '').toLowerCase();
  const dateFrom = sp?.from || null;
  const dateTo = sp?.to || null;
  const limitParam = parseInt(sp?.limit || '200', 10);
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const summaryUrl = `${protocol}://${host}/api/treasury/summary`;

  // Récupère les comptes et le résumé trésorerie
  const [accountsRaw, treasurySummaryRes, missionAdvanceOverview, companyCurrency] = await Promise.all([
    listMoneyAccountsWithBalance(companyId),
    fetch(summaryUrl, { cache: "no-store", headers: { 'x-company-id': companyId } }).then(r => r.ok ? r.json() : {}),
    getMissionAdvanceOverview({ companyId }),
    getCompanyCurrency(companyId),
  ]);
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
    isActive: a.isActive,
    movements: a.movements || []
  }));

  // Récupère les mouvements récents (7 jours)
  const recentMovements = [];
  for (const acc of accountsRaw) {
    if (Array.isArray(acc.movements)) {
      recentMovements.push(...acc.movements.filter(mv => {
        const mvDate = new Date(mv.date || mv.createdAt);
        const now = new Date();
        return (now - mvDate) <= 7 * 24 * 60 * 60 * 1000;
      }).map(mv => ({ ...mv, accountLabel: acc.label, accountCurrency: acc.currency })));
    }
  }

  let ledger = null;
  if (accountId) {
    ledger = await getMoneyAccountLedger({ companyId, moneyAccountId: accountId, limit: limitParam, dateFrom, dateTo });
    if (q) {
      ledger.movements = ledger.movements.filter(m =>
        (m.voucherRef && m.voucherRef.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.invoice?.number && m.invoice.number.toLowerCase().includes(q)) ||
        (m.incomingInvoice?.number && m.incomingInvoice.number.toLowerCase().includes(q)) ||
        (m.employee?.name && m.employee.name.toLowerCase().includes(q)) ||
        (m.beneficiaryLabel && m.beneficiaryLabel.toLowerCase().includes(q)) ||
        (m.supportRef && m.supportRef.toLowerCase().includes(q))
      );
    }
  }

  // Génère l'évolution du solde global sur 30 jours (données simulées)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d;
  });
  const dailyBalances = days.map(d => ({
    date: d,
    value: treasurySummaryRes.balance ?? 0 + Math.floor(Math.random() * 1000 - 500)
  }));

  return (
    <main className="u-main-container u-padding-content-container space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Vue générale trésorerie</h1>
        <p className="text-sm text-slate-600">Soldes, comptes de caisse et de banque, opérations de trésorerie et grand livre.</p>
      </div>

      <TreasuryModuleNav currentHref="/treasury" />

      {/* Filtres synthétiques */}
      <form className="flex flex-wrap gap-4 items-end mb-4" method="get">
        <div className="flex flex-col">
          <label className="text-slate-600">Compte</label>
          <select name="account" defaultValue={accountId || ""} className="border px-2 py-1 rounded text-xs">
            <option value="">Tous les comptes</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-slate-600">Du</label>
          <input type="date" name="from" defaultValue={dateFrom || ""} className="border px-2 py-1 rounded text-xs" />
        </div>
        <div className="flex flex-col">
          <label className="text-slate-600">Au</label>
          <input type="date" name="to" defaultValue={dateTo || ""} className="border px-2 py-1 rounded text-xs" />
        </div>
        <div className="flex flex-col">
          <label className="text-slate-600">Recherche</label>
          <input type="text" name="q" defaultValue={q} placeholder="Réf / desc / facture" className="border px-2 py-1 rounded text-xs" />
        </div>
        <button className="bg-purple-700 text-white px-3 py-1 rounded text-xs" type="submit">Appliquer le filtre</button>
        <Link href="/api/treasury/ledger/export" className="bg-slate-100 text-purple-700 px-3 py-1 rounded text-xs border ml-2" target="_blank">Exporter le grand livre (CSV)</Link>
        <Link href="/api/treasury/ledger/pdf" className="bg-slate-100 text-purple-700 px-3 py-1 rounded text-xs border" target="_blank">Exporter le grand livre (PDF)</Link>
      </form>
      {/* Bloc résumé trésorerie */}
      <section className="bg-purple-50 border border-purple-200 rounded p-4 mb-4 flex flex-wrap gap-6 items-center">
        <div className="text-lg font-semibold text-purple-900">
          Solde global&nbsp;
          <span className={`text-2xl font-bold ml-2 ${treasurySummaryRes.balance < 0 ? "text-red-700" : "text-purple-700"}`}>
            {treasurySummaryRes.balance != null ? formatAmount(treasurySummaryRes.balance, companyCurrency) : "-"}
          </span>
          {treasurySummaryRes.balance < 0 && (
            <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Solde négatif</span>
          )}
        </div>
        <div className="text-sm text-purple-700">Nombre de comptes: <span className="font-bold">{treasurySummaryRes.accounts ?? '-'}</span></div>
        <div className="text-sm text-purple-700">Solde max: <span className="font-bold">{treasurySummaryRes.max != null ? formatAmount(treasurySummaryRes.max, companyCurrency) : '-'}</span></div>
        <div className="text-sm text-purple-700">Solde min: <span className="font-bold">{treasurySummaryRes.min != null ? formatAmount(treasurySummaryRes.min, companyCurrency) : '-'}</span></div>
        <div className="text-sm text-purple-700">Mouvements récents: <span className="font-bold">{treasurySummaryRes.recentCount ?? 0}</span></div>
      </section>
      {/* Graphique synthétique solde global */}
      <section className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Évolution du solde global (30 jours)</h2>
        <div className="w-full h-40">
          {/* Remplacer par un vrai composant chart.js si besoin */}
          <svg width="100%" height="160">
            {dailyBalances.map((b, i) => (
              <circle key={i} cx={(i / 29) * 600 + 20} cy={120 - b.value / 100} r="3" fill="#7c3aed" />
            ))}
          </svg>
        </div>
      </section>
      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">Comptes de trésorerie</h2>
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
                <td className="px-2 py-1"><Link className="text-blue-600 underline" href={{ pathname: '/treasury', query: { account: a.id } }} prefetch={false}>Consulter</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="operations" className="space-y-4">
        <div>
          <h2 className="font-semibold">Saisie et opérations</h2>
          <p className="text-xs text-slate-500">
            Utilisez ces blocs pour enregistrer un mouvement, faire un transfert ou créer un compte.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div id="movements">
            <NewMoneyMovementForm accounts={accounts} defaultCurrency={companyCurrency} />
          </div>
          <div id="transfers">
            <TransferForm accounts={accounts} />
          </div>
          <div id="accounts">
            <NewMoneyAccountForm defaultCurrency={companyCurrency} />
          </div>
        </div>
      </section>

      <section id="mission-advance-regularization">
        <MissionAdvanceRegularizationForm />
      </section>

      <section id="mission-advance-refunds">
        <MissionAdvanceRefundForm accounts={accounts} />
      </section>

      <section id="mission-advances-open">
        <MissionAdvanceOpenPanel overview={missionAdvanceOverview} />
      </section>

      {ledger && (
        <section id="ledger" className="bg-white border rounded p-4 space-y-4">
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
              <button className="bg-blue-600 text-white px-3 py-1 rounded text-xs" type="submit">Appliquer le filtre</button>
              {(dateFrom || dateTo) && (
                <Link
                  href={{ pathname: '/treasury', query: accountId ? { account: accountId } : {} }}
                  className="px-2 py-1 text-xs text-blue-700 underline"
                  prefetch={false}
                >Effacer le filtre</Link>
              )}
            </div>
            {ledger.filter && (
              <div className="text-slate-500 text-xs ml-2">Période filtrée: {ledger.filter.from ? new Date(ledger.filter.from).toLocaleDateString() : 'début'} → {ledger.filter.to ? new Date(ledger.filter.to).toLocaleDateString() : 'fin'}</div>
            )}
          </form>
          <div className="flex flex-wrap gap-3 text-xs mt-1">
            <Link
              href={{ pathname: '/api/treasury/ledger/export', query: { ...(accountId ? { account: accountId } : {}), ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) } }}
              className="px-2 py-1 border rounded bg-slate-50 hover:bg-slate-100"
              target="_blank"
              prefetch={false}
            >Exporter en CSV</Link>
            <Link
              href={{ pathname: '/api/treasury/ledger/pdf', query: { ...(accountId ? { account: accountId } : {}), ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}) } }}
              className="px-2 py-1 border rounded bg-slate-50 hover:bg-slate-100"
              target="_blank"
              prefetch={false}
            >Exporter en PDF</Link>
          </div>
          <div className="text-xs flex flex-wrap gap-6 text-slate-600">
            <span>Ouverture: <strong><Amount value={ledger.openingBalance} currency={ledger.currency || companyCurrency} /></strong></span>
            {ledger.filter && (
              <span>Ouverture initiale compte: <strong><Amount value={ledger.baseOpeningBalance} currency={ledger.currency || companyCurrency} /></strong></span>
            )}
            <span>Entrées: <strong className="text-green-700"><Amount value={ledger.totalIn} currency={ledger.currency || companyCurrency} /></strong></span>
            <span>Sorties: <strong className="text-red-700"><Amount value={ledger.totalOut} currency={ledger.currency || companyCurrency} /></strong></span>
            <span>Clôture: <strong><Amount value={ledger.closingBalance} currency={ledger.currency || companyCurrency} /></strong></span>
            {ledger.limited && <span className="text-amber-600">(affichage limité)</span>}
          </div>
          <table className="w-full text-xs border">
            <thead className="bg-slate-100">
              <tr className="text-left align-bottom">
                <th className="px-2 py-1">Date</th>
                <th className="px-2 py-1">Nature</th>
                <th className="px-2 py-1">Tiers / pièce</th>
                <th className="px-2 py-1">Description</th>
                <th className="px-2 py-1">Réf</th>
                <th className="px-2 py-1">Contrepartie au débit</th>
                <th className="px-2 py-1">Contrepartie au crédit</th>
                <th className="px-2 py-1 text-right">Solde après</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-slate-50 font-medium">
                <td className="px-2 py-1" colSpan={7}>Solde d'ouverture</td>
                <td className="px-2 py-1 text-right tabular-nums"><Amount value={ledger.openingBalance} currency={ledger.currency || companyCurrency} /></td>
              </tr>
              {ledger.movements.map(m => {
                const treasuryLedgerId = ledger.account?.ledgerAccountId;
                const counterpartTransactions = (m.transactions || []).filter(t => t.accountId !== treasuryLedgerId);
                const debitLines = counterpartTransactions.filter(t => t.debit).map(t => ({ label: `${t.accountNumber} ${t.accountLabel}`.trim(), amount: t.debit?.toString() }));
                const creditLines = counterpartTransactions.filter(t => t.credit).map(t => ({ label: `${t.accountNumber} ${t.accountLabel}`.trim(), amount: t.credit?.toString() }));
                const maxRows = Math.max(debitLines.length, creditLines.length, 1);
                return (
                  <React.Fragment key={m.id}>
                    {[...Array(maxRows)].map((_, idx) => (
                      <tr key={m.id+':'+idx} className="border-t last:border-b-0 hover:bg-slate-50 align-top">
                        {idx===0 && (
                          <>
                            <td rowSpan={maxRows} className="px-2 py-1 font-mono whitespace-nowrap">{new Date(m.date).toLocaleDateString()}</td>
                            <td rowSpan={maxRows} className="px-2 py-1">{m.kind}</td>
                            <td rowSpan={maxRows} className="px-2 py-1">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono">{m.invoice?.number || m.incomingInvoice?.number || m.supportRef || ''}</span>
                                {(m.employee?.name || m.beneficiaryLabel || m.supplier?.name) && (
                                  <span className="text-[11px] text-slate-500">
                                    {m.employee?.name || m.beneficiaryLabel || m.supplier?.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td rowSpan={maxRows} className="px-2 py-1 max-w-[180px] truncate" title={m.description}>{m.description}</td>
                            <td rowSpan={maxRows} className="px-2 py-1 font-mono text-[11px]" title={m.voucherRef}>{m.voucherRef}</td>
                          </>
                        )}
                        <td className="px-2 py-1">
                          {debitLines[idx] ? (
                            <div className="flex justify-between gap-2">
                              <span className="font-mono truncate max-w-[140px]" title={debitLines[idx].label}>{debitLines[idx].label || 'Compte non précisé'}</span>
                              <span className="tabular-nums text-green-700"><Amount value={debitLines[idx].amount} currency={ledger.currency || companyCurrency} /></span>
                            </div>
                          ) : idx === 0 ? (<span className="text-slate-400 text-[11px]">Aucune contrepartie</span>) : null}
                        </td>
                        <td className="px-2 py-1">
                          {creditLines[idx] ? (
                            <div className="flex justify-between gap-2">
                              <span className="font-mono truncate max-w-[140px]" title={creditLines[idx].label}>{creditLines[idx].label || 'Compte non précisé'}</span>
                              <span className="tabular-nums text-red-700"><Amount value={creditLines[idx].amount} currency={ledger.currency || companyCurrency} /></span>
                            </div>
                          ) : idx === 0 ? (<span className="text-slate-400 text-[11px]">Aucune contrepartie</span>) : null}
                        </td>
                        {idx===0 && (
                          <td rowSpan={maxRows} className="px-2 py-1 tabular-nums text-right font-medium"><Amount value={m.balanceAfter} currency={ledger.currency || companyCurrency} /></td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
              <tr className="bg-slate-100 font-semibold border-t">
                <td className="px-2 py-1" colSpan={5}>Totaux</td>
                <td className="px-2 py-1 tabular-nums text-green-700"><Amount value={ledger.totalIn} currency={ledger.currency || companyCurrency} /></td>
                <td className="px-2 py-1 tabular-nums text-red-700"><Amount value={ledger.totalOut} currency={ledger.currency || companyCurrency} /></td>
                <td className="px-2 py-1 tabular-nums text-right"><Amount value={ledger.closingBalance} currency={ledger.currency || companyCurrency} /></td>
              </tr>
            </tbody>
          </table>
          {ledger.limited && (
            <div className="mt-3">
              <Link
                className="inline-block text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                href={{ pathname: '/treasury', query: { ...(accountId ? { account: accountId } : {}), ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}), limit: String(limitParam + 200) } }}
                prefetch={false}
              >Afficher 200 lignes de plus</Link>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
