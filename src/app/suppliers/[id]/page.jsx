import Link from "next/link";
import prisma from "@/lib/prisma";
import Amount from "@/components/Amount.jsx";
import SupplierHeader from "@/components/suppliers/SupplierHeader";
import { LetteringPanel } from "@/components/suppliers/lettering/LetteringPanel";

// Page serveur: détail fournisseur + factures reçues + agrégats
export default async function SupplierDetailPage({ params }) {
  const { id } = await params;

  // Récupérer fournisseur + factures reçues + transactions liées pour calculs
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, number: true, label: true } },
      incomingInvoices: {
        orderBy: { receiptDate: "desc" },
        include: {
          lines: true,
          transactions: {
            select: { id: true, kind: true, amount: true, direction: true },
          },
        },
      },
    },
  });

  if (!supplier) return <div className="p-8">Fournisseur introuvable</div>;

  const supplierHeader = {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    account: supplier.account,
  };

  // Agrégats factures
  let totalHt = 0;
  let totalVat = 0;
  let totalTtc = 0;
  let totalOutstanding = 0;

  const invoiceRows = supplier.incomingInvoices.map((inv) => {
    const ht = toNumber(inv.totalAmountHt);
    const vat = toNumber(inv.vatAmount);
    const ttc = toNumber(inv.totalAmount);

    totalHt += ht;
    totalVat += vat;
    totalTtc += ttc;

    const payments = inv.transactions.filter((t) => t.kind === "PAYMENT");
    const paid = payments.reduce((sum, t) => sum + toNumber(t.amount), 0);

    const outstanding = Math.max(0, ttc - paid);
    totalOutstanding += outstanding;

    return {
      id: inv.id,
      entryNumber: inv.entryNumber,
      receiptDate: inv.receiptDate,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status,
      ht,
      vat,
      ttc,
      paid,
      outstanding,
    };
  });

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <SupplierHeader supplier={supplierHeader} />

        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Factures reçues"
            value={supplier.incomingInvoices.length}
          />
          <StatCard label="Total HT" value={totalHt} euro />
          <StatCard label="TVA" value={totalVat} euro />
          <StatCard label="Total TTC" value={totalTtc} euro />
          <StatCard
            label="Restant dû"
            value={totalOutstanding}
            euro
            highlight={totalOutstanding > 0}
          />
        </section>

        <LetteringPanel supplierId={id} />

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
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-6 text-center text-gray-400"
                    >
                      Aucune facture reçue
                    </td>
                  </tr>
                )}
                {invoiceRows.map((row) => {
                  const statusColor =
                    row.status === "PAID"
                      ? "text-green-600"
                      : row.status === "OVERDUE"
                      ? "text-red-600"
                      : "text-orange-600";
                  return (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <Td>
                        <Link
                          href={`/incoming-invoices/${row.id}`}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          {row.entryNumber}
                        </Link>
                      </Td>
                      <Td>
                        {row.receiptDate
                          ? new Date(row.receiptDate).toLocaleDateString()
                          : ""}
                      </Td>
                      <Td>
                        {row.dueDate
                          ? new Date(row.dueDate).toLocaleDateString()
                          : ""}
                      </Td>
                      <Td>
                        <span className={`font-semibold ${statusColor}`}>
                          {row.status}
                        </span>
                      </Td>
                      <Td className="text-right font-mono">
                        <Amount value={row.ht} />
                      </Td>
                      <Td className="text-right font-mono">
                        <Amount value={row.vat} />
                      </Td>
                      <Td className="text-right font-mono">
                        <Amount value={row.ttc} />
                      </Td>
                      <Td className="text-right font-mono text-green-700">
                        <Amount value={row.paid} />
                      </Td>
                      <Td className="text-right font-mono text-red-700">
                        <Amount value={row.outstanding} />
                      </Td>
                      <Td className="whitespace-nowrap space-x-2">
                        <Link
                          href={`/incoming-invoices/${row.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ouvrir
                        </Link>
                        {row.status !== "PAID" && row.outstanding > 0 && (
                          <Link
                            href={`/incoming-invoices/${row.id}?settle=1`}
                            className="text-xs text-amber-700 hover:underline"
                          >
                            Régler
                          </Link>
                        )}
                        <Link
                          href={`/incoming-invoices/edit/${row.id}`}
                          className="text-xs text-gray-600 hover:underline"
                        >
                          Éditer
                        </Link>
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

function StatCard({ label, value, euro = false, highlight = false }) {
  return (
    <div
      className={`p-4 rounded border bg-white shadow-sm ${
        highlight ? "ring-2 ring-red-400" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-lg font-semibold mt-1">
        {euro ? <Amount value={value} /> : value}
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-left font-medium ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function toNumber(value) {
  if (value?.toNumber) return value.toNumber();
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
