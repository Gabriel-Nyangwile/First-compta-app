"use client";
import { useEffect, useState } from "react";

export default function LettrageDebugPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lettrage/debug")
      .then(r => r.json())
      .then(d => { setData(d.lettrage || []); setError(""); })
      .catch(() => setError("Erreur chargement lettrage"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Audit Lettrage (transactions lettrées)</h1>
      {loading && <div>Chargement…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !data.length && <div className="text-gray-400">Aucune transaction lettrée</div>}
      {!loading && !!data.length && (
        <div className="overflow-auto rounded shadow border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Compte</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Fournisseur</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Statut</th>
                {/* <th className="px-3 py-2">Anomalie</th> */}
                <th className="px-3 py-2">Ref</th>
              </tr>
            </thead>
            <tbody>
              {data.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{t.accountId}</td>
                  <td className="px-3 py-2">{t.clientId || '-'}</td>
                  <td className="px-3 py-2">{t.supplierId || '-'}</td>
                  <td className="px-3 py-2 text-right">{Number(t.amount).toLocaleString()}</td>
                  <td className="px-3 py-2">{t.direction}</td>
                  <td className="px-3 py-2">{t.letterStatus}</td>
                  {/* <td className={`px-3 py-2 ${t.anomaly ? 'text-red-700 font-bold' : 'text-gray-400'}`}>{t.anomaly ? 'Oui' : '-'}</td> */}
                  <td className="px-3 py-2 font-mono text-xs">{t.letterRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
