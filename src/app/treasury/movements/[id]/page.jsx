import prisma from '@/lib/prisma';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';

export default async function MovementDetailPage({ params }) {
  const { id } = await params;
  const mv = await prisma.moneyMovement.findUnique({
    where: { id },
    include: {
      moneyAccount: true,
      invoice: { select: { id: true, invoiceNumber: true, client: { select: { name: true } } } },
      incomingInvoice: { select: { id: true, entryNumber: true, supplier: { select: { name: true } } } },
      authorization: { select: { id: true, docNumber: true } },
      bankAdvice: { select: { id: true, refNumber: true } },
      transactions: { select: { id: true, kind: true, amount: true, accountId: true, direction: true } }
    }
  });
  if (!mv) return <div className="p-8 text-sm text-red-600">Mouvement introuvable</div>;
  const isClient = !!mv.invoiceId;
  const isSupplier = !!mv.incomingInvoiceId;
  return (
    <main className="min-h-screen p-8 bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white rounded border shadow p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Mouvement Trésorerie</h1>
            <p className="text-xs text-gray-500">ID: <span className="font-mono">{mv.id}</span></p>
            <p className="text-sm mt-1">Référence pièce: <span className="font-mono font-semibold">{mv.voucherRef}</span></p>
          </div>
          <Link href="/treasury" className="text-sm text-blue-600 underline">Retour trésorerie</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <h2 className="font-semibold">Informations</h2>
            <p><span className="font-medium">Date:</span> {new Date(mv.date).toLocaleString()}</p>
            <p><span className="font-medium">Sens:</span> {mv.direction}</p>
            <p><span className="font-medium">Montant:</span> {formatAmount(mv.amount.toString())}</p>
            <p><span className="font-medium">Kind:</span> {mv.kind}</p>
            <p><span className="font-medium">Compte de trésorerie:</span> {mv.moneyAccount?.label}</p>
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">Liens</h2>
            {isClient && mv.invoice && (
              <p>Facture client: <Link href={`/invoices/${mv.invoice.id}`} className="text-blue-600 underline">{mv.invoice.invoiceNumber} ({mv.invoice.client?.name})</Link></p>
            )}
            {isSupplier && mv.incomingInvoice && (
              <p>Facture fournisseur: <Link href={`/incoming-invoices/${mv.incomingInvoice.id}`} className="text-blue-600 underline">{mv.incomingInvoice.entryNumber} ({mv.incomingInvoice.supplier?.name})</Link></p>
            )}
            {mv.authorization && <p>Autorisation: <span className="font-mono">{mv.authorization.docNumber}</span></p>}
            {mv.bankAdvice && <p>Avis banque: <span className="font-mono">{mv.bankAdvice.refNumber || mv.bankAdvice.id.slice(0,8)}</span></p>}
          </div>
        </div>
        {mv.transactions.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-sm">Transactions associées</h3>
            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr><th className="px-2 py-1 text-left">Direction</th><th className="px-2 py-1 text-left">Kind</th><th className="px-2 py-1 text-left">Compte</th><th className="px-2 py-1 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {mv.transactions.map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="px-2 py-1">{t.direction}</td>
                    <td className="px-2 py-1">{t.kind}</td>
                    <td className="px-2 py-1 font-mono">{t.accountId}</td>
                    <td className="px-2 py-1 text-right">{formatAmount(t.amount.toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}