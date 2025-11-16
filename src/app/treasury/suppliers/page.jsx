import React from 'react';
import Link from 'next/link';
import Amount from '@/components/Amount.jsx';
import { getSupplierTreasuryOverview } from '@/lib/serverActions/money';

const dateFormatter = new Intl.DateTimeFormat('fr-FR');

export default async function TreasurySuppliersPage(props) {
  const sp = await props.searchParams;
  const search = sp?.q?.trim?.() || '';
  const suppliers = await getSupplierTreasuryOverview({ search });
  const outstandingTotal = suppliers.reduce((acc, supplier) => acc + supplier.outstandingTotal, 0);
  const suppliersOverdue = suppliers.filter((supplier) => supplier.overdueCount > 0).length;

  return (
    <main className="u-main-container u-padding-content-container space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Paiements fournisseurs</h1>
        <p className="text-sm text-slate-600">
          Vue d'ensemble des factures fournisseurs en attente de règlement et des derniers paiements saisis.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <div>
            Encours total&nbsp;
            <strong className="tabular-nums"><Amount value={outstandingTotal} currency="EUR" /></strong>
          </div>
          <div>
              Fournisseurs en retard&nbsp;
              <strong className={suppliersOverdue > 0 ? 'text-red-700' : ''}>{suppliersOverdue}</strong>
          </div>
          <Link className="text-blue-600 underline" href="/treasury" prefetch={false}>Retour trésorerie</Link>
        </div>
      </div>

      <section className="bg-white border rounded p-4">
        <form className="flex flex-wrap gap-3 items-end text-sm" method="get">
          <div className="flex flex-col">
            <label className="text-slate-600 text-xs uppercase">Recherche fournisseur</label>
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Nom, email"
              className="border px-3 py-2 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Filtrer</button>
            {search && (
              <Link href="/treasury/suppliers" className="text-blue-700 underline text-sm" prefetch={false}>
                Réinitialiser
              </Link>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {suppliers.length === 0 && (
          <div className="bg-white border rounded p-6 text-center text-sm text-slate-500">
            Aucun fournisseur ne correspond au filtre.
          </div>
        )}
        {suppliers.map((supplier) => {
          const hasInvoices = supplier.invoices.length > 0;
          return (
            <article key={supplier.id} className="bg-white border rounded p-4 space-y-4">
              <header className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{supplier.name}</h2>
                  <div className="text-xs text-slate-500 flex flex-col">
                    <span>Compte fournisseur&nbsp;: {supplier.accountNumber || '—'}</span>
                    {supplier.paymentDelay != null && (
                      <span>Délai de paiement&nbsp;: {supplier.paymentDelay} jours</span>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs uppercase text-slate-500">Encours</div>
                  <div className="text-xl font-bold tabular-nums">
                    <Amount value={supplier.outstandingTotal} currency="EUR" />
                  </div>
                  {supplier.overdueCount > 0 ? (
                    <div className="text-sm text-red-600">{supplier.overdueCount} facture(s) en retard</div>
                  ) : (
                    <div className="text-sm text-slate-500">Aucun retard détecté</div>
                  )}
                  {supplier.nextDueDate && (
                    <div className="text-xs text-slate-500">Prochaine échéance&nbsp;: {dateFormatter.format(new Date(supplier.nextDueDate))}</div>
                  )}
                  <div>
                    <Link
                      href={`/suppliers/${supplier.id}/treasury`}
                      className="text-xs text-blue-600 underline"
                      prefetch={false}
                    >
                      Voir détail règlements
                    </Link>
                  </div>
                </div>
              </header>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Factures à régler</h3>
                  <Link
                    className="text-xs text-blue-600 underline"
                    href={{ pathname: '/incoming-invoices', query: { supplier: supplier.id } }}
                    prefetch={false}
                  >Voir toutes les factures</Link>
                </div>
                {hasInvoices ? (
                  <table className="w-full text-xs border">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr className="text-left">
                        <th className="px-2 py-1">Référence</th>
                        <th className="px-2 py-1">Échéance</th>
                        <th className="px-2 py-1 text-right">Total</th>
                        <th className="px-2 py-1 text-right">Restant</th>
                        <th className="px-2 py-1">Statut</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t">
                          <td className="px-2 py-1 font-mono text-[11px]">{invoice.number}</td>
                          <td className="px-2 py-1">{invoice.dueDate ? dateFormatter.format(new Date(invoice.dueDate)) : '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums"><Amount value={invoice.total} currency="EUR" /></td>
                          <td className="px-2 py-1 text-right tabular-nums font-medium"><Amount value={invoice.outstanding} currency="EUR" /></td>
                          <td className={`px-2 py-1 ${invoice.isOverdue ? 'text-red-600' : 'text-slate-600'}`}>{invoice.status}</td>
                          <td className="px-2 py-1 text-right">
                            <Link
                              className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded"
                              href={{ pathname: '/treasury', query: { quickIncoming: invoice.id } }}
                              prefetch={false}
                            >Enregistrer un paiement</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-xs text-slate-500 border rounded px-3 py-2">Aucune facture en attente.</div>
                )}
                {supplier.invoicesLimited && (
                  <div className="text-xs text-amber-600">Autres factures en attente non affichées. Utilisez la page factures fournisseurs pour le détail complet.</div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Derniers paiements saisis</h3>
                {supplier.payments.length > 0 ? (
                  <ul className="text-xs space-y-1 text-slate-700">
                    {supplier.payments.map((payment) => (
                      <li key={payment.id} className="flex justify-between items-center border rounded px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-[11px] text-slate-500">{payment.date ? dateFormatter.format(new Date(payment.date)) : 'Date ?'}</span>
                          <span>{payment.moneyAccountLabel || 'Compte trésorerie ?'}</span>
                          {payment.voucherRef && (
                            <span className="font-mono text-[11px] text-slate-500">{payment.voucherRef}</span>
                          )}
                        </div>
                        <span className="tabular-nums font-semibold text-green-700"><Amount value={payment.amount} currency="EUR" /></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 border rounded px-3 py-2">Aucun paiement enregistré récemment.</div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
