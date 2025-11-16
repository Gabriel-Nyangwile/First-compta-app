"use client";
import { useEffect, useState } from "react";
import Amount from "@/components/Amount.jsx";
import Link from "next/link";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSuppliers(d.suppliers || []);
      })
      .catch(() => setError("Erreur chargement"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Fournisseurs</h1>
          <Link
            href="/suppliers/create"
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
          >
            Nouveau fournisseur
          </Link>
          <Link
            href="/incoming-invoices"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
          >
            Factures reçues
          </Link>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="bg-white rounded shadow border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Téléphone</th>
                <th className="px-3 py-2 text-left">Compte</th>
                <th className="px-3 py-2 text-right">Factures reçues</th>
                <th className="px-3 py-2 text-right">Total facturé</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-gray-500"
                  >
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading && !suppliers.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-gray-400"
                  >
                    Aucun fournisseur
                  </td>
                </tr>
              )}
              {!loading &&
                suppliers.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2">{s.email || "-"}</td>
                    <td className="px-3 py-2">{s.phone || "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {s.account?.number || "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.incomingInvoicesCount || 0}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      <Amount value={Number(s.incomingInvoicesTotal || 0)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/suppliers/edit/${s.id}`}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Éditer
                      </Link>
                      <Link
                        href={`/suppliers/${s.id}/ledger`}
                        className="text-indigo-600 hover:underline"
                      >
                        Grand Livre
                      </Link>
                      <Link
                        href={`/suppliers/${s.id}/treasury`}
                        className="ml-3 text-blue-700 hover:underline"
                      >
                        Trésorerie
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-8">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded bg-gray-600 hover:bg-gray-700 text-white font-semibold shadow"
          >
            Retour Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
