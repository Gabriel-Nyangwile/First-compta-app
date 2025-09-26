import prisma from '@/lib/prisma';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';

export default async function IncomingInvoiceDetail({ params, searchParams }) {
  const { id } = await params;
  const inv = await prisma.incomingInvoice.findUnique({
    where: { id },
    include: { supplier: true, lines: { include: { account: true } }, transactions: true }
  });
  if (!inv) return <div className="p-8 text-sm text-red-600">Introuvable</div>;
  const paid = Number(inv.paidAmount||0);
  const remaining = Number(inv.outstandingAmount ?? (Number(inv.totalAmount||0) - paid));
  const sp = await searchParams;
  const returnTo = sp?.returnTo ? decodeURIComponent(sp.returnTo) : null;
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Facture Fournisseur {inv.entryNumber}</h1>
          {returnTo ? (
            <Link href={returnTo} className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Retour autorisation</Link>
          ) : (
            <Link href="/incoming-invoices" className="px-3 py-2 bg-blue-600 text-white rounded text-sm">Retour</Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <h2 className="font-semibold mb-1">Fournisseur</h2>
            <p><span className="font-medium">Nom:</span> {inv.supplier?.name||'—'}</p>
            {inv.supplier?.email && <p><span className="font-medium">Email:</span> {inv.supplier.email}</p>}
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
      </div>
    </main>
  );
}