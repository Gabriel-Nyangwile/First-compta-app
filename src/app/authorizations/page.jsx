import { listAuthorizations } from '@/lib/serverActions/authorization';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuthorizationsPage({ searchParams }) {
  const sp = await searchParams;
  const status = sp?.status || '';
  const party = sp?.party || '';
  const partialOnly = sp?.partial === '1';
  let rows = await listAuthorizations({ status: status || undefined, party: party || undefined, limit: 200 });
  if (partialOnly) rows = rows.filter(r => r.partial);
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
              <option value="AUTHORIZED">AUTHORIZED</option>
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
          <button className="bg-blue-600 text-white rounded px-3 py-1 text-xs" type="submit">Filtrer</button>
          {partialOnly && <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-700 px-2 py-1 rounded">Filtre: Partiels</span>}
          <Link href="/authorizations/new" className="ml-auto text-xs px-3 py-1 rounded bg-green-600 text-white">Nouvelle</Link>
        </form>
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
                return (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
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
                        <Link href={`?${new URLSearchParams({ status, party, partial: '1' }).toString()}`} className="inline-block bg-amber-100 border border-amber-300 text-amber-700 rounded px-1 py-0.5 text-[9px]">Partiel</Link>
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
                    <td className="px-2 py-1 space-x-2">
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
