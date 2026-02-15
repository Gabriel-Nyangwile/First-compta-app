"use client";

import { useEffect, useState } from "react";

const legalForms = ["SARL", "SA", "SAS", "SNC", "EURL", "AUTRE"];

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    legalForm: "",
    currency: "CDF",
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

  useEffect(() => {
    loadCompanies();
  }, []);

  function updateLocal(id, patch) {
    setCompanies((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function saveCompany(company) {
    setSavingId(company.id);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN",
        },
        body: JSON.stringify({
          name: company.name,
          legalForm: company.legalForm,
          currency: company.currency,
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
        legalForm: "",
        currency: "CDF",
        vatPolicy: "",
        country: "",
        timezone: "",
        fiscalYearStart: "",
      });
      await loadCompanies();
    } catch (e2) {
      setError(e2.message);
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
      {error && <p className="text-red-600">{error}</p>}
      {success && <p className="text-green-600">{success}</p>}
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
    </main>
  );
}
