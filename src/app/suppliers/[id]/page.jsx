import prisma from '@/lib/prisma';
import Link from 'next/link';
import Amount from '@/components/Amount.jsx';

// Page serveur: détail fournisseur + factures reçues + agrégats
export default async function SupplierDetailPage({ params }) {
  const { id } = await params;

  // Récupérer fournisseur + factures reçues + transactions liées pour calculs
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, number: true, label: true } },
      incomingInvoices: {
        orderBy: { receiptDate: 'desc' },
        include: {
          lines: true,
          transactions: { select: { id: true, kind: true, amount: true, direction: true } }
        }
      }
    }
  });
  if (!supplier) return <div className="p-8">Fournisseur introuvable</div>;

  // Agrégats
  let totalHt = 0, totalVat = 0, totalTtc = 0, totalPaid = 0, totalOutstanding = 0;
  const invoiceRows = supplier.incomingInvoices.map(inv => {
    const ht = Number(inv.totalAmountHt || 0);
    const vat = Number(inv.vatAmount || 0);
    const ttc = Number(inv.totalAmount || 0);
    totalHt += ht; totalVat += vat; totalTtc += ttc;
    // Paiements = somme des transactions PAYMENT sur cette facture (si existant plus tard)
    const payments = inv.transactions.filter(t => t.kind === 'PAYMENT');
    const paid = payments.reduce((s,t)=> s + Number(t.amount), 0);
    totalPaid += paid;
    const outstanding = Math.max(0, ttc - paid);
    totalOutstanding += outstanding;
    return {
      id: inv.id,
      entryNumber: inv.entryNumber,
      receiptDate: inv.receiptDate,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status,
      ht, vat, ttc, paid, outstanding
    };
  });

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Fournisseur : {supplier.name}</h1>
            <div className="text-sm text-gray-600 mt-1 space-y-1">
              {supplier.email && <div>Email : {supplier.email}</div>}
              {supplier.phone && <div>Tél : {supplier.phone}</div>}
              {supplier.address && <div>Adresse : {supplier.address}</div>}
              {supplier.account && <div>Compte : {supplier.account.number} – {supplier.account.label}</div>}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/suppliers" className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">Retour</Link>
            <Link href={`/suppliers/edit/${supplier.id}`} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Éditer</Link>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Factures reçues" value={supplier.incomingInvoices.length} />
          <StatCard label="Total HT" value={totalHt} euro />
          <StatCard label="TVA" value={totalVat} euro />
          <StatCard label="Total TTC" value={totalTtc} euro />
          <StatCard label="Restant dû" value={totalOutstanding} euro highlight={totalOutstanding>0} />
        </section>

        <section className="bg-white border rounded shadow">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Factures fournisseurs reçues</h2>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <Th>Entrée</Th>
                  <Th>Réception</Th>
                  <Th>Échéance</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">HT</Th>
                  <Th className="text-right">TVA</Th>
                  <Th className="text-right">TTC</Th>
                  <Th className="text-right">Payé</Th>
                  <Th className="text-right">Restant</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">Aucune facture reçue</td></tr>
                )}
                {invoiceRows.map(r => {
                  const statusColor = r.status === 'PAID' ? 'text-green-600' : r.status === 'OVERDUE' ? 'text-red-600' : 'text-orange-600';
                  return (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <Td><Link href={`/incoming-invoices/${r.id}`} className="text-blue-600 hover:underline font-mono">{r.entryNumber}</Link></Td>
                      <Td>{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString() : ''}</Td>
                      <Td>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : ''}</Td>
                      <Td><span className={`font-semibold ${statusColor}`}>{r.status}</span></Td>
                      <Td className="text-right font-mono"><Amount value={r.ht} /></Td>
                      <Td className="text-right font-mono"><Amount value={r.vat} /></Td>
                      <Td className="text-right font-mono"><Amount value={r.ttc} /></Td>
                      <Td className="text-right font-mono text-green-700"><Amount value={r.paid} /></Td>
                      <Td className="text-right font-mono text-red-700"><Amount value={r.outstanding} /></Td>
                      <Td className="whitespace-nowrap space-x-2">
                        <Link href={`/incoming-invoices/${r.id}`} className="text-xs text-blue-600 hover:underline">Ouvrir</Link>
                        {r.status !== 'PAID' && r.outstanding > 0 && (
                          <Link href={`/incoming-invoices/${r.id}?settle=1`} className="text-xs text-amber-700 hover:underline">Régler</Link>
                        )}
                        <Link href={`/incoming-invoices/edit/${r.id}`} className="text-xs text-gray-600 hover:underline">Éditer</Link>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, euro=false, highlight=false }) {
  return (
    <div className={`p-4 rounded border bg-white shadow-sm ${highlight ? 'ring-2 ring-red-400' : ''}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold mt-1">{euro ? <Amount value={value} /> : value}</div>
    </div>
  );
}

function Th({ children, className='' }) {
  return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className='' }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
