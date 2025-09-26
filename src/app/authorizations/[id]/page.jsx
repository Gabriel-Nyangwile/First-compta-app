import { authorizeAuthorization, cancelAuthorization, executeAuthorizationViaMovement } from '@/lib/serverActions/authorization';
import prisma from '@/lib/prisma';
import { listMoneyAccountsWithBalance } from '@/lib/serverActions/money';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatAmount, buildInvoiceLink, buildIncomingInvoiceLink } from '@/lib/utils';

async function doAuthorize(formData) { 'use server'; const id = formData.get('id'); await authorizeAuthorization(id); redirect(`/authorizations/${id}`); }
async function doCancel(formData) { 'use server'; const id = formData.get('id'); await cancelAuthorization(id); redirect(`/authorizations/${id}`); }
async function doExecute(formData) { 'use server'; const id = formData.get('id'); const moneyAccountId = formData.get('moneyAccountId'); await executeAuthorizationViaMovement({ authorizationId: id, moneyAccountId }); redirect(`/authorizations/${id}`); }

export default async function AuthorizationDetailPage({ params }) {
  const { id } = await params;
  const auth = await prisma.treasuryAuthorization.findUnique({
    where: { id },
    include: {
      moneyMovements: true,
      invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, outstandingAmount: true } },
      incomingInvoice: { select: { id: true, entryNumber: true, supplierInvoiceNumber: true, totalAmount: true, paidAmount: true, outstandingAmount: true } }
    }
  });
  if (!auth) return <main className="p-8">Introuvable</main>;
  const accounts = await listMoneyAccountsWithBalance();
  return (
    <main className="u-main-container u-padding-content-container space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Autorisation #{auth.docNumber}</h1>
        <span className="text-xs px-2 py-1 rounded bg-slate-200">{auth.status}</span>
      </div>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="bg-white border rounded p-4 space-y-2">
          <h2 className="font-medium">Infos</h2>
          <div>Type: {auth.docType}</div>
          <div>Scope: {auth.scope}</div>
          <div>Flow: {auth.flow}</div>
          <div>Montant: {formatAmount(auth.amount.toString(), auth.currency)}</div>
          <div>Devise: {auth.currency}</div>
          <div>Objet: {auth.purpose || '—'}</div>
          <div>Invoice: {auth.invoice ? (
            <Link href={buildInvoiceLink(auth.invoice.id, auth.id)} className="text-blue-600 underline">
              {auth.invoice.invoiceNumber}
            </Link>
          ) : '—'}</div>
          <div>Incoming: {auth.incomingInvoice ? (
            <Link href={buildIncomingInvoiceLink(auth.incomingInvoice.id, auth.id)} className="text-blue-600 underline">
              {auth.incomingInvoice.entryNumber || auth.incomingInvoice.supplierInvoiceNumber}
            </Link>
          ) : '—'}</div>
          {auth.invoice && (
            <div className="text-[11px] text-slate-600">Reste facture: {formatAmount((auth.invoice.outstandingAmount || auth.invoice.totalAmount).toString(), auth.currency)} / Total {formatAmount(auth.invoice.totalAmount.toString(), auth.currency)} {Number(auth.amount) > Number((auth.invoice.outstandingAmount || auth.invoice.totalAmount).toString()) && <span className="ml-1 text-red-600 font-semibold">(Dépasse)</span>}</div>
          )}
          {auth.incomingInvoice && (
            <div className="text-[11px] text-slate-600">Reste fournisseur: {formatAmount((auth.incomingInvoice.outstandingAmount || auth.incomingInvoice.totalAmount).toString(), auth.currency)} / Total {formatAmount(auth.incomingInvoice.totalAmount.toString(), auth.currency)} {Number(auth.amount) > Number((auth.incomingInvoice.outstandingAmount || auth.incomingInvoice.totalAmount).toString()) && <span className="ml-1 text-red-600 font-semibold">(Dépasse)</span>}</div>
          )}
          <div>Exécuté le: {auth.executedAt ? new Date(auth.executedAt).toLocaleString() : '—'}</div>
        </div>
        <div className="bg-white border rounded p-4 space-y-4">
          <h2 className="font-medium">Actions</h2>
          {auth.status === 'DRAFT' && (
            <form action={doAuthorize} className="space-y-2">
              <input type="hidden" name="id" value={auth.id} />
              <button className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Autoriser</button>
            </form>
          )}
          {auth.status === 'AUTHORIZED' && (
            <>
              <form action={doExecute} className="space-y-2">
                <input type="hidden" name="id" value={auth.id} />
                <label className="text-xs font-medium">Compte trésorerie</label>
                <select name="moneyAccountId" required className="border rounded px-2 py-1 text-xs w-full">
                  <option value="">-- Choisir --</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.label} ({a.computedBalance.toString()})</option>)}
                </select>
                <button className="bg-green-600 text-white px-3 py-1 rounded text-xs">Exécuter</button>
              </form>
              <form action={doCancel} className="space-y-2">
                <input type="hidden" name="id" value={auth.id} />
                <button className="bg-red-600 text-white px-3 py-1 rounded text-xs">Annuler</button>
              </form>
            </>
          )}
          {auth.status === 'CANCELLED' && <div className="text-xs text-red-500">Annulée</div>}
          {auth.status === 'EXECUTED' && <div className="text-xs text-green-700">Exécutée</div>}
          <div className="pt-2 border-t space-y-2">
            <Link href="/authorizations" className="inline-block text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100">Retour liste</Link>
            <Link href="/authorizations/new" className="inline-block text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100">Nouvelle autorisation</Link>
            <form action={async () => { 'use server'; redirect(`/authorizations/new?duplicate=${auth.id}`); }} className="inline-block">
              <button type="submit" className="text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100">Dupliquer</button>
            </form>
            {auth.invoice && (
              <Link href={buildInvoiceLink(auth.invoice.id, auth.id)} className="inline-block text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100">Voir facture</Link>
            )}
            {auth.incomingInvoice && (
              <Link href={buildIncomingInvoiceLink(auth.incomingInvoice.id, auth.id)} className="inline-block text-xs px-2 py-1 rounded border bg-slate-50 hover:bg-slate-100">Voir facture fournisseur</Link>
            )}
          </div>
        </div>
        <div className="bg-white border rounded p-4 space-y-2">
          <h2 className="font-medium">Mouvements liés</h2>
          <ul className="list-disc ml-4 text-xs space-y-1">
            {auth.moneyMovements.map(m => (
              <li key={m.id}>
                {new Date(m.date).toLocaleDateString()} – {m.direction} {m.amount.toString()} ({m.kind})
                {' '}<Link href={`/treasury?account=${m.moneyAccountId}#mv-${m.id}`} className="text-blue-600 underline">voir</Link>
              </li>
            ))}
            {!auth.moneyMovements.length && <li>Aucun</li>}
          </ul>
        </div>
        <div className="bg-white border rounded p-4 space-y-2">
          <h2 className="font-medium">Historique statut</h2>
          <ol className="text-xs space-y-1">
            <li>Créé: {new Date(auth.issueDate).toLocaleString()}</li>
            {auth.status !== 'DRAFT' && <li>Autorisé: {auth.status!=='DRAFT' && auth.status!=='CANCELLED' && auth.status!=='EXECUTED' ? 'Date inconnue (journalisation non implémentée)' : (auth.status==='EXECUTED' || auth.status==='CANCELLED') ? '—' : '—'}</li>}
            {auth.executedAt && <li>Exécuté: {new Date(auth.executedAt).toLocaleString()}</li>}
            {auth.status === 'CANCELLED' && <li>Annulé (timestamp non stocké)</li>}
          </ol>
          <p className="text-[10px] text-slate-500">Pour un suivi précis, ajouter plus tard des timestamps dédiés (authorizedAt, cancelledAt).</p>
        </div>
      </div>
    </main>
  );
}
