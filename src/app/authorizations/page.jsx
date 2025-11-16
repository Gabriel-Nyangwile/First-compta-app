import { listAuthorizations, authorizeAuthorization } from '@/lib/serverActions/authorization';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { formatAmount } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function approveAuthorizationFromList(formData) { 'use server';
  const id = formData.get('id');
  if (!id) return;
  await authorizeAuthorization(id);
  revalidatePath('/authorizations');
}

export default async function AuthorizationsPage({ searchParams }) {
  const sp = await searchParams;
  const status = sp?.status || '';
  const party = sp?.party || '';
  const partialOnly = sp?.partial === '1';
  const exceededOnly = sp?.exceeded === '1';
  let rows = await listAuthorizations({ status: status || undefined, party: party || undefined, limit: 200 });
  if (partialOnly) rows = rows.filter(r => r.partial);
  if (exceededOnly) rows = rows.filter(r => r.exceededRemaining);

  const stats = rows.reduce((acc, r) => {
    const amt = Number(r.amount || 0) || 0;
    acc.totalCount += 1;
    acc.totalAmount += amt;
    acc.byStatus[r.status] = (acc.byStatus[r.status] || 0) + 1;
    if (r.partial) { acc.partial.count += 1; acc.partial.amount += amt; }
    if (r.exceededRemaining) { acc.exceeded.count += 1; acc.exceeded.amount += amt; }
    return acc;
  }, { totalCount:0, totalAmount:0, byStatus:{}, partial:{count:0,amount:0}, exceeded:{count:0,amount:0} });
  return (
    <main className="u-main-container u-padding-content-container space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Autorisations Trésorerie</h1>
        <p className="text-sm text-slate-600">Lot1 – PCD / PCR / OP (workflow basique).</p>
      </header>
      <section className="bg-white border rounded p-4 space-y-3">
        <form method="get" className="flex flex-wrap gap-4 items-end text-xs">
          <div className="flex flex-col">
            <label className="text-slate-500">Statut</label>
            <select name="status" defaultValue={status} className="border rounded px-2 py-1 text-xs">
              <option value="">(Tous)</option>
              <option value="DRAFT">DRAFT</option>
              <option value="APPROVED">APPROVED</option>
              <option value="EXECUTED">EXECUTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-slate-500">Client / Fournisseur</label>
            <select name="party" defaultValue={party} className="border rounded px-2 py-1 text-xs">
              <option value="">(Tous)</option>
              <option value="CLIENT">Client</option>
              <option value="SUPPLIER">Fournisseur</option>
            </select>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" name="partial" value="1" defaultChecked={partialOnly} /> <span>Partiels</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" name="exceeded" value="1" defaultChecked={exceededOnly} /> <span>Dépassements</span>
            </label>
          </div>
          <button className="bg-blue-600 text-white rounded px-3 py-1 text-xs" type="submit">Filtrer</button>
          {partialOnly && <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-700 px-2 py-1 rounded">Partiels</span>}
          {exceededOnly && <span className="text-[10px] bg-red-100 border border-red-300 text-red-700 px-2 py-1 rounded">Dépassements</span>}
          <Link href="/authorizations/new" className="ml-auto text-xs px-3 py-1 rounded bg-green-600 text-white">Nouvelle</Link>
        </form>
        <div className="grid md:grid-cols-4 gap-3 text-[11px] mt-2">
          <div className="p-2 border rounded bg-slate-50">
            <div className="text-slate-500">Total autorisations</div>
            <div className="font-semibold tabular-nums">{stats.totalCount}</div>
          </div>
          <div className="p-2 border rounded bg-slate-50">
            <div className="text-slate-500">Montant cumulé</div>
            <div className="font-semibold tabular-nums">{formatAmount(stats.totalAmount, 'EUR')}</div>
          </div>
          <div className="p-2 border rounded bg-amber-50">
            <div className="text-amber-600">Partiels</div>
            <div className="font-semibold tabular-nums">{stats.partial.count} / {formatAmount(stats.partial.amount, 'EUR')}</div>
          </div>
            <div className="p-2 border rounded bg-red-50">
              <div className="text-red-600">Dépassements</div>
              <div className="font-semibold tabular-nums">{stats.exceeded.count} / {formatAmount(stats.exceeded.amount, 'EUR')}</div>
            </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs border">
            <thead className="bg-slate-100">
              <tr className="text-left">
                <th className="px-2 py-1">Doc#</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Flow</th>
                <th className="px-2 py-1">Montant</th>
                <th className="px-2 py-1">Monnaie</th>
                <th className="px-2 py-1">Facture</th>
                <th className="px-2 py-1">Restant</th>
                <th className="px-2 py-1">Destinataire / Provenance</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const partial = r.partial;
                const exceeded = r.exceededRemaining;
                return (
                  <tr key={r.id} className={`border-t hover:bg-slate-50 ${exceeded ? 'bg-red-50/50' : ''}`}>
                    <td className="px-2 py-1 font-mono text-[10px]">{r.docNumber}</td>
                    <td className="px-2 py-1">{r.docType}</td>
                    <td className="px-2 py-1">{r.flow}</td>
                    <td className="px-2 py-1 tabular-nums" title={r.amount}>{formatAmount(r.amount, r.currency)}</td>
                    <td className="px-2 py-1">{r.currency}</td>
                    <td className="px-2 py-1 text-[10px] space-x-1">
                      { (r.invoiceNumber || r.incomingInvoiceNumber) ? (
                        <Link href={ r.invoiceNumber ? `/invoices?number=${r.invoiceNumber}` : `/incoming-invoices?number=${r.incomingInvoiceNumber}` } className="underline decoration-dotted hover:text-blue-600">
                          {r.invoiceNumber || r.incomingInvoiceNumber}
                        </Link>
                      ) : '' }
                      {partial && (
                        <Link href={`?${new URLSearchParams({ status, party, partial: '1', exceeded: exceededOnly ? '1' : '' }).toString()}`} className="inline-block bg-amber-100 border border-amber-300 text-amber-700 rounded px-1 py-0.5 text-[9px]">Partiel</Link>
                      )}
                      {exceeded && (
                        <Link href={`?${new URLSearchParams({ status, party, exceeded: '1', partial: partialOnly ? '1' : '' }).toString()}`} className="inline-block bg-red-100 border border-red-300 text-red-700 rounded px-1 py-0.5 text-[9px]" title="Montant autorisé > restant dû">Dépasse</Link>
                      )}
                    </td>
                    <td className="px-2 py-1 text-[10px] tabular-nums" title={r.remainingAmount ? `${r.remainingAmount} restant` : ''}>
                      {r.remainingAmount ? formatAmount(r.remainingAmount, r.currency) : ''}
                      {r.exceededRemaining && (
                        <span className="ml-1 inline-block bg-red-100 border border-red-300 text-red-700 rounded px-1 py-0.5 text-[9px]" title="Montant autorisé dépasse le restant dû">!</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-[10px]">{r.partyName || '—'}</td>
                    <td className="px-2 py-1">{r.status}</td>
                    <td className="px-2 py-1 flex items-center gap-2">
                      {r.status === 'DRAFT' && (
                        <form action={approveAuthorizationFromList} className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-500 focus:outline-none focus:ring-1 focus:ring-green-400">Approuver</button>
                        </form>
                      )}
                      <Link href={`/authorizations/${r.id}`} className="text-blue-600 underline">Ouvrir</Link>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">Aucune autorisation</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
