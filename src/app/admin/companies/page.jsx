"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const legalForms = ["SARL", "SA", "SAS", "SNC", "EURL", "AUTRE"];

export default function AdminCompaniesPage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-5xl mx-auto">Chargement…</main>}>
      <AdminCompaniesPageContent />
    </Suspense>
  );
}

function AdminCompaniesPageContent() {
  const [companies, setCompanies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const createOnly = searchParams?.get("create") === "1";
  const [createForm, setCreateForm] = useState({
    name: "",
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

  async function loadCompanies() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies", {
        cache: "no-store",
        headers: { "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement sociétés");
      setCompanies(data.companies || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests() {
    setRequestsLoading(true);
    try {
      const res = await fetch("/api/company-creation-requests", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement demandes");
      setRequests(data.requests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
    loadRequests();
  }, []);

  function updateLocal(id, patch) {
    setCompanies((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function saveCompany(company) {
    setSavingId(company.id);
    setError("");
    setSuccess("");
    try {
      if (!company.rccmNumber || !company.idNatNumber || !company.taxNumber || !company.cnssNumber || !company.onemNumber || !company.inppNumber) {
        setError("RCCM, IdNat, N° Impôt, CNSS, ONEM et INPP sont obligatoires.");
        setSavingId(null);
        return;
      }
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN",
        },
        body: JSON.stringify({
          name: company.name,
          address: company.address,
          legalForm: company.legalForm,
          currency: company.currency,
          rccmNumber: company.rccmNumber,
          idNatNumber: company.idNatNumber,
          taxNumber: company.taxNumber,
          cnssNumber: company.cnssNumber,
          onemNumber: company.onemNumber,
          inppNumber: company.inppNumber,
          vatPolicy: company.vatPolicy,
          country: company.country,
          timezone: company.timezone,
          fiscalYearStart: company.fiscalYearStart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mise à jour échouée");
      updateLocal(company.id, data.company || {});
      setSuccess("Société mise à jour");
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function createCompany(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN",
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création échouée");
      setSuccess("Société créée");
      setCreateForm({
        name: "",
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
      const created = data.company;
      const wantsCreate = searchParams?.get("create") === "1";
      const pending = localStorage.getItem("pendingCompanyId");
      if (created?.id && (wantsCreate || pending === "NEW")) {
        document.cookie = `company-id=${encodeURIComponent(created.id)}; path=/`;
        localStorage.setItem("pendingCompanyId", created.id);
        router.push("/dashboard");
        return;
      }
      await loadCompanies();
      await loadRequests();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function reviewRequest(id, action) {
    setSavingId(id);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/company-creation-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: action === "approve" ? "Approved from admin UI" : "Rejected from admin UI" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Traitement échoué");
      setSuccess(action === "approve" ? "Demande approuvée" : "Demande rejetée");
      await loadCompanies();
      await loadRequests();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Sociétés</h1>
        <a
          href="/"
          className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
        >
          ← Retour au menu
        </a>
      </div>
      <p className="text-sm text-gray-600">
        Cette page permet de corriger les informations d&apos;une société existante
        (forme juridique, devise, TVA, etc.).
      </p>
      {loading ? <p>Chargement…</p> : null}
      {requestsLoading ? <p>Chargement des demandes…</p> : null}
      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-green-600">{success}</p>}
      <section className="border rounded bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Demandes de création</h2>
        {requests.length === 0 ? <p className="text-sm text-gray-500">Aucune demande en attente.</p> : null}
        {requests.map((request) => (
          <div key={request.id} className="border rounded p-3 text-sm space-y-2">
            <div className="font-medium">{request.requestedName}</div>
            <div className="text-gray-600">
              Statut: {request.status}
              {request.requesterUser ? ` • Demandeur: ${request.requesterUser.username || request.requesterUser.email}` : ""}
            </div>
            <div className="text-gray-500">
              RCCM: {request.rccmNumber || "-"} • IdNat: {request.idNatNumber || "-"} • Impôt: {request.taxNumber || "-"}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-1 bg-emerald-600 text-white text-xs rounded disabled:opacity-50"
                disabled={savingId === request.id || request.status !== "PENDING"}
                onClick={() => reviewRequest(request.id, "approve")}
              >
                Approuver
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-red-600 text-white text-xs rounded disabled:opacity-50"
                disabled={savingId === request.id || request.status !== "PENDING"}
                onClick={() => reviewRequest(request.id, "reject")}
              >
                Rejeter
              </button>
            </div>
          </div>
        ))}
      </section>
      <form onSubmit={createCompany} className="border rounded bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Créer une société</h2>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Nom *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-gray-600">Adresse</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.address}
              onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Adresse complète"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° RCCM *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.rccmNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, rccmNumber: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° IdNat *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.idNatNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, idNatNumber: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° Impôt *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.taxNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, taxNumber: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° CNSS *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.cnssNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, cnssNumber: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° ONEM *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.onemNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, onemNumber: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">N° INPP *</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.inppNumber}
              onChange={(e) => setCreateForm((f) => ({ ...f, inppNumber: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Forme</span>
            <select
              className="border rounded px-2 py-1"
              value={createForm.legalForm}
              onChange={(e) => setCreateForm((f) => ({ ...f, legalForm: e.target.value }))}
            >
              <option value="">--</option>
              {legalForms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Devise (défaut: CDF)</span>
            <input
              className="border rounded px-2 py-1 uppercase"
              value={createForm.currency}
              onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-gray-600">Politique TVA</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.vatPolicy}
              onChange={(e) => setCreateForm((f) => ({ ...f, vatPolicy: e.target.value }))}
              placeholder="Ex: STANDARD 16%, EXONERE, MIXTE, REGIME_SIMPLIFIE…"
            />
            <span className="text-[11px] text-gray-500">
              Indique le régime ou le taux appliqué (ex: Standard 16%, Exonéré, Mixte).
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Pays</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.country}
              onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Timezone</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.timezone}
              onChange={(e) => setCreateForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="Africa/Kinshasa"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Début exercice (MM-DD)</span>
            <input
              className="border rounded px-2 py-1"
              value={createForm.fiscalYearStart}
              onChange={(e) => setCreateForm((f) => ({ ...f, fiscalYearStart: e.target.value }))}
              placeholder="01-01"
            />
          </label>
        </div>
        <div>
          <button type="submit" className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">
            Créer société
          </button>
        </div>
      </form>

      {!createOnly && (
        <div className="space-y-4">
        {companies.map((c) => (
          <div key={c.id} className="border rounded bg-white p-4 space-y-3">
            <div className="text-xs text-gray-500 font-mono">ID: {c.id}</div>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Nom</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.name || ""}
                  onChange={(e) => updateLocal(c.id, { name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Forme</span>
                <select
                  className="border rounded px-2 py-1"
                  value={c.legalForm || ""}
                  onChange={(e) => updateLocal(c.id, { legalForm: e.target.value })}
                >
                  <option value="">--</option>
                  {legalForms.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Devise</span>
                <input
                  className="border rounded px-2 py-1 uppercase"
                  value={c.currency || ""}
                  onChange={(e) => updateLocal(c.id, { currency: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs text-gray-600">Adresse</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.address || ""}
                  onChange={(e) => updateLocal(c.id, { address: e.target.value })}
                  placeholder="Adresse complète"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">N° RCCM *</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.rccmNumber || ""}
                  onChange={(e) => updateLocal(c.id, { rccmNumber: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">N° IdNat *</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.idNatNumber || ""}
                  onChange={(e) => updateLocal(c.id, { idNatNumber: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">N° Impôt *</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.taxNumber || ""}
                  onChange={(e) => updateLocal(c.id, { taxNumber: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">N° CNSS *</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.cnssNumber || ""}
                  onChange={(e) => updateLocal(c.id, { cnssNumber: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">N° ONEM *</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.onemNumber || ""}
                  onChange={(e) => updateLocal(c.id, { onemNumber: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">N° INPP *</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.inppNumber || ""}
                  onChange={(e) => updateLocal(c.id, { inppNumber: e.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Politique TVA</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.vatPolicy || ""}
                  onChange={(e) => updateLocal(c.id, { vatPolicy: e.target.value })}
                />
                <span className="text-[11px] text-gray-500">
                  Indique le régime ou le taux appliqué (ex: Standard 16%, Exonéré, Mixte).
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Pays</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.country || ""}
                  onChange={(e) => updateLocal(c.id, { country: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Timezone</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.timezone || ""}
                  onChange={(e) => updateLocal(c.id, { timezone: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">Début exercice (MM-DD)</span>
                <input
                  className="border rounded px-2 py-1"
                  value={c.fiscalYearStart || ""}
                  onChange={(e) => updateLocal(c.id, { fiscalYearStart: e.target.value })}
                  placeholder="01-01"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                disabled={savingId === c.id}
                onClick={() => saveCompany(c)}
              >
                {savingId === c.id ? "..." : "Sauver"}
              </button>
            </div>
          </div>
        ))}
        {!loading && companies.length === 0 && (
          <div className="text-sm text-gray-500">Aucune société trouvée.</div>
        )}
        </div>
      )}
    </main>
  );
}
