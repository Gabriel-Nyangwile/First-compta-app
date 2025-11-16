"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function BankAdvicesPage() {
  // Formulaire de création
  const [form, setForm] = useState({
    adviceType: "CREDIT",
    amount: "",
    adviceDate: "",
    currency: "EUR",
    refNumber: "",
    purpose: "",
    authorizationId: ""
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const handleFormChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleCreate = async e => {
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
          adviceDate: form.adviceDate || new Date().toISOString().slice(0,10)
        })
      });
      if (!res.ok) throw new Error("Erreur création avis bancaire");
      setForm({ adviceType: "CREDIT", amount: "", adviceDate: "", currency: "EUR", refNumber: "", purpose: "", authorizationId: "" });
      // Rafraîchir la liste
      await fetchAdvices();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // Filtres avancés
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
    async function fetchAdvices() {
      setLoading(true);
      try {
        const res = await fetch("/api/bank-advices");
        if (!res.ok) throw new Error("Erreur chargement avis bancaires");
        const data = await res.json();
        setAdvices(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAdvices();
  }, []);

  let filtered = advices;
  if (filterType) filtered = filtered.filter(a => a.adviceType === filterType);
  if (filterDate) filtered = filtered.filter(a => a.adviceDate?.slice(0,10) === filterDate);
  if (filterMin) filtered = filtered.filter(a => Number(a.amount) >= Number(filterMin));
  if (filterMax) filtered = filtered.filter(a => Number(a.amount) <= Number(filterMax));
  if (filterCurrency) filtered = filtered.filter(a => a.currency === filterCurrency);
  if (filterRef) filtered = filtered.filter(a => a.refNumber?.includes(filterRef));
  if (filterAuth) filtered = filtered.filter(a => a.authorizationId === filterAuth);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Avis bancaires</h1>

      {/* Formulaire de création */}
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
          <button type="submit" disabled={creating} className="bg-blue-700 text-white px-4 py-1 rounded">{creating ? "Création..." : "Créer"}</button>
        </div>
        {createError && <div className="text-red-600 mt-2">{createError}</div>}
      </form>

      {/* Filtres avancés */}
      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <button
          className={`px-3 py-1 rounded ${filterType === "" ? "bg-blue-700 text-white" : "bg-gray-100"}`}
          onClick={() => setFilterType("")}
        >Tous</button>
        <button
          className={`px-3 py-1 rounded ${filterType === "CREDIT" ? "bg-green-600 text-white" : "bg-gray-100"}`}
          onClick={() => setFilterType("CREDIT")}
        >Crédit</button>
        <button
          className={`px-3 py-1 rounded ${filterType === "DEBIT" ? "bg-red-600 text-white" : "bg-gray-100"}`}
          onClick={() => setFilterType("DEBIT")}
        >Débit</button>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded px-2 py-1" placeholder="Date" />
        <input type="number" step="0.01" value={filterMin} onChange={e => setFilterMin(e.target.value)} className="border rounded px-2 py-1 w-20" placeholder="Min" />
        <input type="number" step="0.01" value={filterMax} onChange={e => setFilterMax(e.target.value)} className="border rounded px-2 py-1 w-20" placeholder="Max" />
        <input value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} className="border rounded px-2 py-1 w-16" placeholder="Devise" />
        <input value={filterRef} onChange={e => setFilterRef(e.target.value)} className="border rounded px-2 py-1 w-24" placeholder="Référence" />
        <input value={filterAuth} onChange={e => setFilterAuth(e.target.value)} className="border rounded px-2 py-1 w-24" placeholder="Autorisation" />
        <button className="px-2 py-1 rounded bg-gray-200" onClick={() => { setFilterDate(""); setFilterMin(""); setFilterMax(""); setFilterCurrency(""); setFilterRef(""); setFilterAuth(""); }}>Réinitialiser</button>
      </div>

      {loading && <div>Chargement...</div>}
      {error && <div className="text-red-600">{error}</div>}
      <table className="w-full border mt-4 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Date</th>
            <th className="p-2">Type</th>
            <th className="p-2">Montant</th>
            <th className="p-2">Devise</th>
            <th className="p-2">Référence</th>
            <th className="p-2">Motif</th>
            <th className="p-2">Facture liée</th>
            <th className="p-2">Autorisation</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && !loading && (
            <tr><td colSpan={9} className="text-center p-4">Aucun avis bancaire</td></tr>
          )}
          {filtered.map(a => (
            <tr key={a.id} className="border-b">
              <td className="p-2">{a.adviceDate?.slice(0,10)}</td>
              <td className="p-2">{a.adviceType}</td>
              <td className={`p-2 font-bold ${a.adviceType === "CREDIT" ? "text-green-700" : "text-red-700"}`}>{Number(a.amount)?.toLocaleString()} €</td>
              <td className="p-2">{a.currency}</td>
              <td className="p-2">{a.refNumber ?? "-"}</td>
              <td className="p-2">{a.purpose ?? ""}</td>
              <td className="p-2">
                {a.invoiceId ? <Link href={`/invoices/${a.invoiceId}`} className="underline text-blue-700">Facture</Link> :
                 a.incomingInvoiceId ? <Link href={`/incoming-invoices/${a.incomingInvoiceId}`} className="underline text-orange-700">Fournisseur</Link> : "-"}
              </td>
              <td className="p-2">
                {a.authorizationId ? <Link href={`/authorizations/${a.authorizationId}`} className="underline text-purple-700">Autorisation</Link> : "-"}
              </td>
              <td className="p-2">
                <button className="text-red-600 underline" onClick={async () => {
                  if (confirm("Supprimer cet avis bancaire ?")) {
                    try {
                      const res = await fetch(`/api/bank-advices/${a.id}`, { method: "DELETE" });
                      if (!res.ok) throw new Error("Erreur suppression");
                      await fetchAdvices();
                    } catch (e) {
                      alert(e.message);
                    }
                  }
                }}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
