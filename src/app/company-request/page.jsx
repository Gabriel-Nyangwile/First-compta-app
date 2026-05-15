"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const legalForms = ["SARL", "SA", "SAS", "SNC", "EURL", "AUTRE"];

export default function CompanyRequestPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    requestedName: "",
    reason: "",
    address: "",
    legalForm: "",
    currency: "CDF",
    rccmNumber: "",
    idNatNumber: "",
    taxNumber: "",
    cnssNumber: "",
    onemNumber: "",
    inppNumber: "",
    vatPolicy: "",
    country: "",
    timezone: "",
    fiscalYearStart: "",
  });

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/company-creation-requests", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement demandes");
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/company-creation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création de la demande échouée");
      setSuccess("Demande transmise. Un administrateur plateforme doit maintenant l’approuver.");
      setForm({
        requestedName: "",
        reason: "",
        address: "",
        legalForm: "",
        currency: "CDF",
        rccmNumber: "",
        idNatNumber: "",
        taxNumber: "",
        cnssNumber: "",
        onemNumber: "",
        inppNumber: "",
        vatPolicy: "",
        country: "",
        timezone: "",
        fiscalYearStart: "",
      });
      document.cookie = "company-id=NEW; path=/";
      await loadRequests();
    } catch (e2) {
      setError(e2.message);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Demande de création de société</h1>
          <p className="text-sm text-gray-600">
            Vous pouvez demander la création d’une nouvelle société, mais seul un administrateur plateforme peut l’approuver.
          </p>
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
          onClick={() => router.push("/")}
        >
          Retour
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-green-600">{success}</p>}

      <form onSubmit={handleSubmit} className="border rounded bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Nouvelle demande</h2>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Nom *</span>
            <input className="border rounded px-2 py-1" value={form.requestedName} onChange={(e) => setForm((f) => ({ ...f, requestedName: e.target.value }))} required />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-gray-600">Adresse</span>
            <input className="border rounded px-2 py-1" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-xs text-gray-600">Motif de la demande *</span>
            <textarea
              className="border rounded px-2 py-1 min-h-24"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° RCCM</span>
            <input className="border rounded px-2 py-1" value={form.rccmNumber} onChange={(e) => setForm((f) => ({ ...f, rccmNumber: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° IdNat</span>
            <input className="border rounded px-2 py-1" value={form.idNatNumber} onChange={(e) => setForm((f) => ({ ...f, idNatNumber: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° Impôt</span>
            <input className="border rounded px-2 py-1" value={form.taxNumber} onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° CNSS</span>
            <input className="border rounded px-2 py-1" value={form.cnssNumber} onChange={(e) => setForm((f) => ({ ...f, cnssNumber: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° ONEM</span>
            <input className="border rounded px-2 py-1" value={form.onemNumber} onChange={(e) => setForm((f) => ({ ...f, onemNumber: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° INPP</span>
            <input className="border rounded px-2 py-1" value={form.inppNumber} onChange={(e) => setForm((f) => ({ ...f, inppNumber: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Forme</span>
            <select className="border rounded px-2 py-1" value={form.legalForm} onChange={(e) => setForm((f) => ({ ...f, legalForm: e.target.value }))}>
              <option value="">--</option>
              {legalForms.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Devise</span>
            <input className="border rounded px-2 py-1 uppercase" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Pays</span>
            <input className="border rounded px-2 py-1" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Timezone</span>
            <input className="border rounded px-2 py-1" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Début exercice (MM-DD)</span>
            <input className="border rounded px-2 py-1" value={form.fiscalYearStart} onChange={(e) => setForm((f) => ({ ...f, fiscalYearStart: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-xs text-gray-600">Politique TVA</span>
            <input className="border rounded px-2 py-1" value={form.vatPolicy} onChange={(e) => setForm((f) => ({ ...f, vatPolicy: e.target.value }))} />
          </label>
        </div>
        <button type="submit" className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">
          Envoyer la demande
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Mes demandes</h2>
        {loading ? <p>Chargement…</p> : null}
        {!loading && requests.length === 0 ? <p className="text-sm text-gray-500">Aucune demande.</p> : null}
        {requests.map((request) => (
          <div key={request.id} className="border rounded bg-white p-4 text-sm space-y-1">
            <div className="font-medium">{request.requestedName}</div>
            <div className="text-gray-600">Statut: {request.status}</div>
            {request.reason ? <div className="text-gray-600">Motif: {request.reason}</div> : null}
            <div className="text-gray-500">Soumis le {new Date(request.createdAt).toLocaleString()}</div>
            {request.createdCompany ? <div className="text-green-700">Société créée: {request.createdCompany.name}</div> : null}
            {request.reviewNote ? <div className="text-gray-600">Note: {request.reviewNote}</div> : null}
          </div>
        ))}
      </section>
    </main>
  );
}
