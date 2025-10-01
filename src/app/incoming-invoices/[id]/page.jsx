import prisma from '@/lib/prisma';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';
import DownloadIncomingInvoicePDFButton from '@/components/DownloadIncomingInvoicePDFButton';

export default async function IncomingInvoiceDetail({ params, searchParams }) {
  const { id } = await params;
  const inv = await prisma.incomingInvoice.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { account: true } }, transactions: true, purchaseOrder: { select: { id: true, number: true } }, moneyMovements: { select: { id: true, date: true, amount: true, direction: true, kind: true, voucherRef: true, moneyAccount: { select: { label: true } } }, orderBy: { date: 'asc' } } }
  });
  if (!inv) return <div className="p-8 text-sm text-red-600">Introuvable</div>;
  const paid = Number(inv.paidAmount||0);
  const remaining = Number(inv.outstandingAmount ?? (Number(inv.totalAmount||0) - paid));
  const sp = await searchParams;
  const returnTo = sp?.returnTo ? decodeURIComponent(sp.returnTo) : null;
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200 space-y-6">
        <div className="flex justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold">Facture Fournisseur {inv.entryNumber}</h1>
            {inv.purchaseOrder && (
              <p className="text-xs text-gray-600">Bon de commande lié : <Link href={`/purchase-orders/${inv.purchaseOrder.id}`} className="text-blue-600 underline">{inv.purchaseOrder.number}</Link></p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DownloadIncomingInvoicePDFButton incomingInvoiceId={inv.id} />
            {returnTo ? (
              <Link href={returnTo} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Retour autorisation</Link>
            ) : (
              <Link href="/incoming-invoices" className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Retour</Link>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <h2 className="font-semibold mb-1">Fournisseur</h2>
            <p><span className="font-medium">Nom:</span> {inv.supplier?.name||'—'}</p>
            {inv.supplier?.email && <p><span className="font-medium">Email:</span> {inv.supplier.email}</p>}
            {inv.purchaseOrder && <p><span className="font-medium">Bon de commande:</span> <Link href={`/purchase-orders/${inv.purchaseOrder.id}`} className="text-blue-600 underline">{inv.purchaseOrder.number}</Link></p>}
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold mb-1">Montants</h2>
            <p>Total: {formatAmount(inv.totalAmount.toString())}</p>
            <p>Payé: {formatAmount(paid.toString())}</p>
            <p>Reste: {formatAmount(remaining.toString())}</p>
            <p>Statut: {inv.status}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Lignes</h3>
          <table className="w-full text-xs border">
            <thead className="bg-gray-100"><tr><th className="px-2 py-1 text-left">Desc</th><th className="px-2 py-1 text-left">Compte</th><th className="px-2 py-1 text-right">HT</th></tr></thead>
            <tbody>
              {inv.lines.map(l => <tr key={l.id} className="border-t"><td className="px-2 py-1">{l.description}</td><td className="px-2 py-1 font-mono">{l.account.number}</td><td className="px-2 py-1 text-right">{formatAmount(l.lineTotal.toString())}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Écritures</h3>
          <table className="w-full text-xs border">
            <thead className="bg-gray-100"><tr><th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">Sens</th><th className="px-2 py-1 text-left">Compte</th><th className="px-2 py-1 text-right">Montant</th><th className="px-2 py-1 text-left">Kind</th></tr></thead>
            <tbody>
              {inv.transactions.map(t => <tr key={t.id} className="border-t"><td className="px-2 py-1">{new Date(t.date).toLocaleDateString()}</td><td className="px-2 py-1">{t.direction}</td><td className="px-2 py-1 font-mono">{t.accountId}</td><td className="px-2 py-1 text-right">{formatAmount(t.amount.toString())}</td><td className="px-2 py-1">{t.kind}</td></tr>)}
            </tbody>
          </table>
        </div>
        {Array.isArray(inv.moneyMovements) && inv.moneyMovements.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Pièces de paiement (voucherRef)</h3>
            <ul className="space-y-1 text-xs">
              {inv.moneyMovements.map(m => (
                <li key={m.id} className="flex justify-between">
                  <span className="text-gray-600">{new Date(m.date).toLocaleDateString()} • {m.moneyAccount?.label || 'Compte'} • {m.direction === 'OUT' ? 'Paiement' : 'Entrée'}</span>
                  <a href={`/treasury/movements/${m.id}`} className="font-mono text-indigo-600 underline">{m.voucherRef}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}