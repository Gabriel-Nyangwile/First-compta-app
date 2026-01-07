"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CapitalOperationsPage() {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "CONSTITUTION",
    form: "SARL",
    nominalTarget: "",
    premiumTarget: "",
    decisionRef: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/capital-operations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement");
      setOps(Array.isArray(data.operations) ? data.operations : []);
    } catch (e) {
      setError(e.message || "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createOp(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/capital-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nominalTarget: form.nominalTarget ? Number(form.nominalTarget) : undefined,
          premiumTarget: form.premiumTarget ? Number(form.premiumTarget) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création échouée");
      setForm({
        type: "CONSTITUTION",
        form: "SARL",
        nominalTarget: "",
        premiumTarget: "",
        decisionRef: "",
      });
      await load();
    } catch (e) {
      setError(e.message || "Création échouée");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opérations de capital</h1>
      </div>

      <form onSubmit={createOp} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">Nouvelle opération</span>
          <button
            type="submit"
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Créer
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <label className="space-y-1">
            <span>Type</span>
            <select
              className="w-full border rounded px-2 py-1"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="CONSTITUTION">Constitution</option>
              <option value="AUGMENTATION">Augmentation</option>
            </select>
          </label>
          <label className="space-y-1">
            <span>Forme</span>
            <select
              className="w-full border rounded px-2 py-1"
              value={form.form}
              onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))}
            >
              <option value="SARL">SARL</option>
              <option value="SA">SA</option>
            </select>
          </label>
          <label className="space-y-1">
            <span>Réf. décision (PV)</span>
            <input
              className="w-full border rounded px-2 py-1"
              value={form.decisionRef}
              onChange={(e) => setForm((f) => ({ ...f, decisionRef: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span>Capital cible (nominal)</span>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={form.nominalTarget}
              onChange={(e) => setForm((f) => ({ ...f, nominalTarget: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span>Prime (optionnel)</span>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={form.premiumTarget}
              onChange={(e) => setForm((f) => ({ ...f, premiumTarget: e.target.value }))}
            />
          </label>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>

      <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Réf</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Forme</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2 text-left">Nominal</th>
              <th className="px-3 py-2 text-left">Prime</th>
              <th className="px-3 py-2 text-left">Souscriptions</th>
              <th className="px-3 py-2 text-left">Appels</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && !ops.length && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Aucune opération.
                </td>
              </tr>
            )}
            {ops.map((op) => (
              <tr key={op.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/capital-operations/${op.id}`} className="text-blue-600 underline">
                    {op.ref}
                  </Link>
                </td>
                <td className="px-3 py-2">{op.type}</td>
                <td className="px-3 py-2">{op.form}</td>
                <td className="px-3 py-2">{op.status}</td>
                <td className="px-3 py-2">{Number(op.nominalTarget || 0).toLocaleString()}</td>
                <td className="px-3 py-2">{op.premiumTarget ? Number(op.premiumTarget).toLocaleString() : "-"}</td>
                <td className="px-3 py-2 text-center">{op.subscriptions?.length || 0}</td>
                <td className="px-3 py-2 text-center">{op.calls?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
