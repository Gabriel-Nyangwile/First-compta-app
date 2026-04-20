"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TreasuryModuleNav from "@/components/treasury/TreasuryModuleNav.jsx";
import { formatAmount } from "@/lib/utils";

const ADVICE_TYPE_LABELS = {
  CREDIT: "Crédit",
  DEBIT: "Débit",
};

export default function BankAdvicesPageClient({ defaultCurrency = "XOF" }) {
  const [form, setForm] = useState({
    adviceType: "CREDIT",
    amount: "",
    adviceDate: "",
    currency: defaultCurrency,
    refNumber: "",
    purpose: "",
    authorizationId: ""
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterRef, setFilterRef] = useState("");
  const [filterAuth, setFilterAuth] = useState("");
  const [advices, setAdvices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("");

  useEffect(() => {
    setForm((current) => {
      if (current.currency && current.currency !== "EUR") return current;
      return { ...current, currency: defaultCurrency };
    });
  }, [defaultCurrency]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  async function fetchAdvices() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bank-advices");
      if (!res.ok) throw new Error("Erreur chargement des avis bancaires");
      const data = await res.json();
      setAdvices(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAdvices();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/bank-advices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          adviceDate: form.adviceDate || new Date().toISOString().slice(0, 10)
        })
      });
      if (!res.ok) throw new Error("Erreur lors de la création de l'avis bancaire");
      setForm({
        adviceType: "CREDIT",
        amount: "",
        adviceDate: "",
        currency: defaultCurrency,
        refNumber: "",
        purpose: "",
        authorizationId: ""
      });
      await fetchAdvices();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  let filtered = advices;
  if (filterType) filtered = filtered.filter((advice) => advice.adviceType === filterType);
  if (filterDate) filtered = filtered.filter((advice) => advice.adviceDate?.slice(0, 10) === filterDate);
  if (filterMin) filtered = filtered.filter((advice) => Number(advice.amount) >= Number(filterMin));
  if (filterMax) filtered = filtered.filter((advice) => Number(advice.amount) <= Number(filterMax));
  if (filterCurrency) filtered = filtered.filter((advice) => advice.currency === filterCurrency);
  if (filterRef) filtered = filtered.filter((advice) => advice.refNumber?.includes(filterRef));
  if (filterAuth) filtered = filtered.filter((advice) => advice.authorizationId === filterAuth);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Avis bancaires</h1>
      <p className="text-sm text-slate-600 mb-4">
        Saisie, consultation et exécution des avis bancaires liés aux opérations de trésorerie.
      </p>

      <div className="mb-6">
        <TreasuryModuleNav currentHref="/bank-advices" />
      </div>

      <form className="mb-6 p-4 border rounded bg-gray-50" onSubmit={handleCreate}>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs">Type</label>
            <select name="adviceType" value={form.adviceType} onChange={handleFormChange} className="border rounded px-2 py-1">
              <option value="CREDIT">Crédit</option>
              <option value="DEBIT">Débit</option>
            </select>
          </div>
          <div>
            <label className="block text-xs">Montant</label>
            <input name="amount" type="number" step="0.01" value={form.amount} onChange={handleFormChange} className="border rounded px-2 py-1 w-24" required />
          </div>
          <div>
            <label className="block text-xs">Date</label>
            <input name="adviceDate" type="date" value={form.adviceDate} onChange={handleFormChange} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs">Devise</label>
            <input name="currency" value={form.currency} onChange={handleFormChange} className="border rounded px-2 py-1 w-16" />
          </div>
          <div>
            <label className="block text-xs">Référence</label>
            <input name="refNumber" value={form.refNumber} onChange={handleFormChange} className="border rounded px-2 py-1 w-32" />
          </div>
          <div>
            <label className="block text-xs">Motif</label>
            <input name="purpose" value={form.purpose} onChange={handleFormChange} className="border rounded px-2 py-1 w-32" />
          </div>
          <div>
            <label className="block text-xs">Autorisation liée</label>
            <input name="authorizationId" value={form.authorizationId} onChange={handleFormChange} className="border rounded px-2 py-1 w-32" />
          </div>
          <button type="submit" disabled={creating} className="bg-blue-700 text-white px-4 py-1 rounded">{creating ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
        {createError && <div className="text-red-600 mt-2">{createError}</div>}
      </form>

      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <button
          type="button"
          className={`px-3 py-1 rounded ${filterType === "" ? "bg-blue-700 text-white" : "bg-gray-100"}`}
          onClick={() => setFilterType("")}
        >Tous les avis</button>
        <button
          type="button"
          className={`px-3 py-1 rounded ${filterType === "CREDIT" ? "bg-green-600 text-white" : "bg-gray-100"}`}
          onClick={() => setFilterType("CREDIT")}
        >Avis créditeurs</button>
        <button
          type="button"
          className={`px-3 py-1 rounded ${filterType === "DEBIT" ? "bg-red-600 text-white" : "bg-gray-100"}`}
          onClick={() => setFilterType("DEBIT")}
        >Avis débiteurs</button>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="border rounded px-2 py-1" placeholder="Date" />
        <input type="number" step="0.01" value={filterMin} onChange={(e) => setFilterMin(e.target.value)} className="border rounded px-2 py-1 w-20" placeholder="Min" />
        <input type="number" step="0.01" value={filterMax} onChange={(e) => setFilterMax(e.target.value)} className="border rounded px-2 py-1 w-20" placeholder="Max" />
        <input value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)} className="border rounded px-2 py-1 w-16" placeholder="Devise" />
        <input value={filterRef} onChange={(e) => setFilterRef(e.target.value)} className="border rounded px-2 py-1 w-24" placeholder="Référence" />
        <input value={filterAuth} onChange={(e) => setFilterAuth(e.target.value)} className="border rounded px-2 py-1 w-24" placeholder="Autorisation" />
        <button type="button" className="px-2 py-1 rounded bg-gray-200" onClick={() => { setFilterDate(""); setFilterMin(""); setFilterMax(""); setFilterCurrency(""); setFilterRef(""); setFilterAuth(""); }}>Réinitialiser</button>
      </div>

      {loading && <div>Chargement des avis...</div>}
      {error && <div className="text-red-600">{error}</div>}
      <table className="w-full border mt-4 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Date</th>
            <th className="p-2">Sens</th>
            <th className="p-2">Montant</th>
            <th className="p-2">Devise</th>
            <th className="p-2">Référence</th>
            <th className="p-2">Motif</th>
            <th className="p-2">Pièce liée</th>
            <th className="p-2">Autorisation</th>
            <th className="p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && !loading && (
            <tr><td colSpan={9} className="text-center p-4">Aucun avis bancaire enregistré pour ce filtre</td></tr>
          )}
          {filtered.map((advice) => (
            <tr key={advice.id} className="border-b">
              <td className="p-2">{advice.adviceDate?.slice(0, 10)}</td>
              <td className="p-2">{ADVICE_TYPE_LABELS[advice.adviceType] || advice.adviceType}</td>
              <td className={`p-2 font-bold ${advice.adviceType === "CREDIT" ? "text-green-700" : "text-red-700"}`}>{formatAmount(advice.amount, advice.currency || defaultCurrency)}</td>
              <td className="p-2">{advice.currency}</td>
              <td className="p-2">{advice.refNumber ?? "-"}</td>
              <td className="p-2">{advice.purpose ?? ""}</td>
              <td className="p-2">
                {advice.invoiceId ? <Link href={`/invoices/${advice.invoiceId}`} className="underline text-blue-700">Facture client</Link> :
                 advice.incomingInvoiceId ? <Link href={`/incoming-invoices/${advice.incomingInvoiceId}`} className="underline text-orange-700">Facture fournisseur</Link> : "-"}
              </td>
              <td className="p-2">
                {advice.authorizationId ? <Link href={`/authorizations/${advice.authorizationId}`} className="underline text-purple-700">Consulter</Link> : "-"}
              </td>
              <td className="p-2">
                <button className="text-red-600 underline" onClick={async () => {
                  if (confirm("Supprimer cet avis bancaire ?")) {
                    try {
                      const res = await fetch(`/api/bank-advices/${advice.id}`, { method: "DELETE" });
                      if (!res.ok) throw new Error("Erreur lors de la suppression");
                      await fetchAdvices();
                    } catch (e) {
                      alert(e.message);
                    }
                  }
                }}>Supprimer l'avis</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
