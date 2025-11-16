"use client";

import Link from "next/link";

export default function SupplierHeader({ supplier }) {
  return (
    <header className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold">Fournisseur : {supplier.name}</h1>
        <div className="text-sm text-gray-600 mt-1 space-y-1">
          {supplier.email && <div>Email : {supplier.email}</div>}
          {supplier.phone && <div>Tél : {supplier.phone}</div>}
          {supplier.address && <div>Adresse : {supplier.address}</div>}
          {supplier.account && (
            <div>
              Compte : {supplier.account.number} – {supplier.account.label}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          href="/suppliers"
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
        >
          Retour
        </Link>
        <Link
          href={`/suppliers/edit/${supplier.id}`}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          Éditer
        </Link>
      </div>
    </header>
  );
}
