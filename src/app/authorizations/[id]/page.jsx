import { authorizeAuthorization, cancelAuthorization, deleteAuthorization, executeAuthorizationViaMovement } from '@/lib/serverActions/authorization';
import prisma from '@/lib/prisma';
import { listMoneyAccountsWithBalance } from '@/lib/serverActions/money';
import { listTreasuryLedgerAccountsWithBalance } from '@/lib/treasuryAccounts';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatAmount, buildInvoiceLink, buildIncomingInvoiceLink } from '@/lib/utils';
import { cookies } from 'next/headers';
import { getCompanyIdFromCookies } from '@/lib/tenant';

async function doApprove(formData) { 'use server'; const id = formData.get('id'); const companyId = getCompanyIdFromCookies(await cookies()); await authorizeAuthorization(id, companyId); redirect(`/authorizations/${id}`); }
async function doCancel(formData) { 'use server'; const id = formData.get('id'); const companyId = getCompanyIdFromCookies(await cookies()); await cancelAuthorization(id, companyId); redirect(`/authorizations/${id}`); }
async function doExecute(formData) { 'use server'; const id = formData.get('id'); const moneyAccountId = formData.get('moneyAccountId'); const companyId = getCompanyIdFromCookies(await cookies()); await executeAuthorizationViaMovement({ authorizationId: id, moneyAccountId, companyId }); redirect(`/authorizations/${id}`); }
async function doDelete(formData) { 'use server'; const id = formData.get('id'); const companyId = getCompanyIdFromCookies(await cookies()); await deleteAuthorization(id, companyId); redirect(`/authorizations?deleted=1`); }

export default async function AuthorizationDetailPage({ params }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) return <main className="p-8">companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).</main>;
  const auth = await prisma.treasuryAuthorization.findFirst({
    where: { id, companyId },
    include: {
      moneyMovements: true,
      bankAdvices: { select: { id: true, refNumber: true, adviceDate: true } },
      invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, outstandingAmount: true } },
      incomingInvoice: { select: { id: true, entryNumber: true, supplierInvoiceNumber: true, totalAmount: true, paidAmount: true, outstandingAmount: true } }
    }
  });
  if (!auth) return <main className="p-8">Introuvable</main>;
  const beneficiaryAccount = auth.beneficiaryAccountId
    ? await prisma.account.findFirst({
        where: { id: auth.beneficiaryAccountId, companyId },
        select: { id: true, number: true, label: true },
      })
    : null;
  const [moneyAccounts, treasuryAccountsRaw] = await Promise.all([
    listMoneyAccountsWithBalance(companyId),
    listTreasuryLedgerAccountsWithBalance(companyId, { includeUnused: true }),
  ]);
  const linkedMoneyAccountIds = new Set(
    treasuryAccountsRaw.map((account) => account.moneyAccountId).filter(Boolean)
  );
  const accounts = [
    ...treasuryAccountsRaw.map((account) => ({
      id: account.moneyAccountId || `ledger:${account.id}`,
      label: `${account.number} - ${account.moneyAccountLabel || account.label}`,
      computedBalance: account.computedBalance,
    })),
    ...moneyAccounts
      .filter((account) => !linkedMoneyAccountIds.has(account.id))
      .map((account) => ({
        id: account.id,
        label: account.ledgerAccount?.number
          ? `${account.ledgerAccount.number} - ${account.label}`
          : account.label,
        computedBalance: account.computedBalance?.toString?.() || account.computedBalance,
      })),
  ];
  const movementCount = auth.moneyMovements?.length || 0;
  const adviceCount = auth.bankAdvices?.length || 0;
  const canDelete =
    ["DRAFT", "CANCELLED"].includes(auth.status) &&
    movementCount === 0 &&
    adviceCount === 0;
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
          <div>Compte autre: {beneficiaryAccount ? `${beneficiaryAccount.number} - ${beneficiaryAccount.label}` : '—'}</div>
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
            <form action={doApprove} className="space-y-2">
              <input type="hidden" name="id" value={auth.id} />
              <button className="bg-blue-600 text-white px-3 py-1 rounded text-xs">Approuver</button>
            </form>
          )}
          {auth.status === 'APPROVED' && (
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
          {canDelete && (
            <form action={doDelete} className="space-y-2">
              <input type="hidden" name="id" value={auth.id} />
              <button className="bg-red-700 text-white px-3 py-1 rounded text-xs">Supprimer définitivement</button>
              <p className="text-[10px] text-slate-500">
                Autorisé seulement pour un brouillon ou une autorisation annulée, sans mouvement ni avis bancaire lié.
              </p>
            </form>
          )}
          {!canDelete && ["DRAFT", "CANCELLED"].includes(auth.status) && (
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Suppression indisponible : {movementCount > 0 ? `${movementCount} mouvement${movementCount > 1 ? 's' : ''} lié${movementCount > 1 ? 's' : ''}` : null}
              {movementCount > 0 && adviceCount > 0 ? ' et ' : null}
              {adviceCount > 0 ? `${adviceCount} avis bancaire${adviceCount > 1 ? 's' : ''} lié${adviceCount > 1 ? 's' : ''}` : null}.
            </p>
          )}
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
          <h2 className="font-medium">Avis bancaires liés</h2>
          <ul className="list-disc ml-4 text-xs space-y-1">
            {auth.bankAdvices.map((advice) => (
              <li key={advice.id}>
                {new Date(advice.adviceDate).toLocaleDateString()} {advice.refNumber ? `– ${advice.refNumber}` : ''}
              </li>
            ))}
            {!auth.bankAdvices.length && <li>Aucun</li>}
          </ul>
        </div>
        <div className="bg-white border rounded p-4 space-y-2">
          <h2 className="font-medium">Historique statut</h2>
          <ol className="text-xs space-y-1">
            <li>Créé: {new Date(auth.issueDate).toLocaleString()}</li>
            {auth.status !== 'DRAFT' && <li>Approuvé: {auth.status!=='DRAFT' && auth.status!=='CANCELLED' && auth.status!=='EXECUTED' ? 'Date inconnue (journalisation non implémentée)' : (auth.status==='EXECUTED' || auth.status==='CANCELLED') ? '—' : '—'}</li>}
            {auth.executedAt && <li>Exécuté: {new Date(auth.executedAt).toLocaleString()}</li>}
            {auth.status === 'CANCELLED' && <li>Annulé (timestamp non stocké)</li>}
          </ol>
          <p className="text-[10px] text-slate-500">Pour un suivi précis, ajouter plus tard des timestamps dédiés (approvedAt, cancelledAt).</p>
        </div>
      </div>
    </main>
  );
}
