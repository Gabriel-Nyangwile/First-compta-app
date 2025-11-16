import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import SupplierHeader from "@/components/suppliers/SupplierHeader";
import SupplierTreasuryPanel from "@/components/suppliers/treasury/SupplierTreasuryPanel";

export default async function SupplierTreasuryPage({ params }) {
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      account: { select: { number: true, label: true } },
    },
  });

  if (!supplier) notFound();

  const supplierHeader = {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    account: supplier.account,
  };

  const paymentDelay = normalizeNumber(supplier.paymentDelay);

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <SupplierHeader supplier={supplierHeader} />
            <p className="text-sm text-slate-600">
              Suivi trésorerie fournisseur
            </p>
            <div className="text-xs text-slate-500 space-x-4">
              <span>
                Compte général&nbsp;:
                <span className="ml-1 font-mono text-[11px]">
                  {supplier.account?.number || "?"}
                </span>
              </span>
              {paymentDelay != null && (
                <span>Délai paiement&nbsp;: {paymentDelay} jours</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/treasury/suppliers"
              prefetch={false}
              className="px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Retour vue fournisseurs
            </Link>
            <Link
              href={{ pathname: "/incoming-invoices", query: { supplier: supplier.id } }}
              prefetch={false}
              className="px-3 py-2 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Factures fournisseur
            </Link>
          </div>
        </div>

        <SupplierTreasuryPanel supplierId={id} />
      </div>
    </main>
  );
}

function normalizeNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (value?.toNumber) return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
