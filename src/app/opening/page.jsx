"use client";

import { useEffect, useMemo, useState } from "react";
import { can, getClientRole } from "@/lib/clientRbac";

const steps = [
  { kind: "balance", label: "Balance générale", hint: "Comptes et soldes débit/crédit équilibrés." },
  { kind: "stock", label: "Stock d'ouverture", hint: "Produits, quantités, coûts unitaires et comptes de stock." },
  { kind: "ar", label: "Clients ouverts", hint: "Tiers clients avec comptes 411 et soldes débiteurs." },
  { kind: "ap", label: "Fournisseurs ouverts", hint: "Tiers fournisseurs avec comptes 401 et soldes créditeurs." },
  { kind: "assets", label: "Immobilisations", hint: "Actifs, catégories, coûts, amortissements et VNC." },
];

function formatValue(value) {
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString("fr-FR");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ReportBlock({ report }) {
  if (!report) return null;
  if (!report.ok) {
    return (
      <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {report.error || "Erreur import"}
      </div>
    );
  }
  const summaryEntries = Object.entries(report.summary || {});
  const preview = report.preview || [];
  const columns = preview.length ? Object.keys(preview[0]).slice(0, 6) : [];

  return (
    <div className="mt-3 border border-emerald-200 bg-emerald-50">
      <div className="grid gap-2 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs uppercase text-emerald-700">Mode</div>
          <div className="font-medium text-emerald-950">{report.mode}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-emerald-700">Lignes</div>
          <div className="font-medium text-emerald-950">{report.rows}</div>
        </div>
        {summaryEntries.slice(0, 6).map(([key, value]) => (
          <div key={key}>
            <div className="text-xs uppercase text-emerald-700">{key}</div>
            <div className="font-medium text-emerald-950">{formatValue(value)}</div>
          </div>
        ))}
      </div>
      {preview.length > 0 && (
        <div className="overflow-x-auto border-t border-emerald-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-emerald-100 text-emerald-900">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100 bg-white">
              {preview.slice(0, 5).map((row, idx) => (
                <tr key={`${report.kind}-${idx}`}>
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2 text-gray-700">
                      {formatValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function OpeningPage() {
  const [openingDate, setOpeningDate] = useState("2026-01-01");
  const [files, setFiles] = useState({});
  const [reports, setReports] = useState({});
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const role = useMemo(() => getClientRole(), []);
  const allowed = can("manageOpening", role);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/opening/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement statut");
      setStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  function setFile(kind, file) {
    setFiles((current) => ({ ...current, [kind]: file || null }));
    setReports((current) => ({ ...current, [kind]: null }));
  }

  async function submit(kind, mode) {
    const file = files[kind];
    if (!file) {
      setReports((current) => ({
        ...current,
        [kind]: { ok: false, error: "Sélectionner un fichier Excel." },
      }));
      return;
    }
    if (mode === "import") {
      const confirmed = window.confirm(
        "Confirmer l'import définitif ? Cette action crée des écritures et données d'ouverture."
      );
      if (!confirmed) return;
    }
    setBusy(`${kind}:${mode}`);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("openingDate", openingDate);
      form.append("mode", mode);
      const res = await fetch(`/api/opening/${kind}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setReports((current) => ({ ...current, [kind]: data }));
      if (!res.ok) throw new Error(data.error || "Erreur import");
      if (mode === "import") await loadStatus();
    } catch (err) {
      setReports((current) => ({
        ...current,
        [kind]: { ok: false, error: err.message },
      }));
    } finally {
      setBusy("");
    }
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ouverture d'exercice</h1>
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Accès réservé aux rôles comptables autorisés.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ouverture d'exercice</h1>
          <p className="mt-1 text-sm text-gray-600">
            Import guidé des soldes, stocks, tiers et immobilisations d'une société.
          </p>
        </div>
        <label className="text-sm font-medium text-gray-700">
          Date d'ouverture
          <input
            type="date"
            value={openingDate}
            onChange={(event) => setOpeningDate(event.target.value)}
            className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-5 border-b border-gray-200 pb-5">
        <h2 className="text-lg font-semibold text-gray-900">Statut société</h2>
        {loadingStatus ? (
          <div className="mt-3 text-sm text-gray-500">Chargement...</div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(status?.counts || {}).map(([key, value]) => (
              <div key={key} className="border border-gray-200 px-3 py-3">
                <div className="text-xs uppercase text-gray-500">{key}</div>
                <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 border-b border-gray-200 pb-5">
        <h2 className="text-lg font-semibold text-gray-900">Modèles Excel</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {steps.map((step) => (
            <a
              key={step.kind}
              href={`/api/opening/templates/${step.kind}`}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
            >
              {step.label}
            </a>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-lg font-semibold text-gray-900">Imports</h2>
        <div className="mt-3 space-y-4">
          {steps.map((step, index) => {
            const dryRunOk = reports[step.kind]?.ok;
            const currentBusy = busy.startsWith(`${step.kind}:`);
            return (
              <div key={step.kind} className="border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs font-medium uppercase text-gray-500">
                      Etape {index + 1}
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">{step.label}</h3>
                    <p className="mt-1 text-sm text-gray-600">{step.hint}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={(event) => setFile(step.kind, event.target.files?.[0])}
                      className="max-w-xs text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => submit(step.kind, "dry-run")}
                      disabled={currentBusy}
                      className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Prévisualiser
                    </button>
                    <button
                      type="button"
                      onClick={() => submit(step.kind, "import")}
                      disabled={currentBusy || !dryRunOk}
                      className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Importer
                    </button>
                  </div>
                </div>
                {currentBusy && <div className="mt-3 text-sm text-gray-500">Traitement...</div>}
                <ReportBlock report={reports[step.kind]} />
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
