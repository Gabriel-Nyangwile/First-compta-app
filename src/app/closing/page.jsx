"use client";

import { useMemo, useState } from "react";
import { can, getClientRole } from "@/lib/clientRbac";

function fmt(value) {
  return Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function dateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("fr-FR");
}

function closingStatusLabel(status) {
  if (status === "CLOSED") return "Cloture";
  if (status === "REOPENED") return "Reouvert";
  return status || "";
}

export default function ClosingPage() {
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [profitAccountNumber, setProfitAccountNumber] = useState("121100");
  const [lossAccountNumber, setLossAccountNumber] = useState("129100");
  const [report, setReport] = useState(null);
  const [allocationReport, setAllocationReport] = useState(null);
  const [allocationForm, setAllocationForm] = useState({
    corporateTaxRate: "0.30",
    minimumTaxRate: "0.01",
    legalReserveRate: "0.10",
    legalReserveCapRate: "0.20",
    irmRate: "0.20",
    statutoryReserveAmount: "0",
    optionalReserveAmount: "0",
    dividendsGrossAmount: "0",
    taxExpenseAccountNumber: "891000",
    minimumTaxExpenseAccountNumber: "895000",
    taxPayableAccountNumber: "441000",
    legalReserveAccountNumber: "113800",
    statutoryReserveAccountNumber: "113800",
    optionalReserveAccountNumber: "118100",
    retainedEarningsAccountNumber: "121100",
    lossRetainedAccountNumber: "129100",
    dividendsPayableAccountNumber: "465000",
    irmPayableAccountNumber: "447000",
    agoReference: "",
    decisionDate: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const role = useMemo(() => getClientRole(), []);
  const allowed = can("manageClosing", role);

  async function control() {
    setBusy("control");
    setError("");
    try {
      const params = new URLSearchParams({
        year: String(year),
        profitAccountNumber,
        lossAccountNumber,
      });
      const res = await fetch(`/api/closing/annual?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setReport(data);
      setAllocationReport(null);
      if (!res.ok) throw new Error(data.error || "Controle impossible");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function setAllocationField(field, value) {
    setAllocationForm((current) => ({ ...current, [field]: value }));
  }

  function allocationPayload() {
    return { year, ...allocationForm };
  }

  async function simulateAllocation() {
    setBusy("allocation");
    setError("");
    try {
      const params = new URLSearchParams(allocationPayload());
      const res = await fetch(`/api/closing/profit-allocation?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setAllocationReport(data);
      if (!res.ok) throw new Error(data.error || "Simulation affectation impossible");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function approveAllocation() {
    const confirmed = window.confirm(
      "Valider le calcul fiscal et la decision AGO ? L'impot societe sera comptabilise si necessaire."
    );
    if (!confirmed) return;
    setBusy("approve-allocation");
    setError("");
    try {
      const res = await fetch("/api/closing/profit-allocation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allocationPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation affectation impossible");
      await simulateAllocation();
      await control();
    } catch (err) {
      setError(err.message);
      setBusy("");
    }
  }

  async function generateOpening() {
    const confirmed = window.confirm(
      "Generer les a-nouveaux definitifs pour l'exercice suivant ?"
    );
    if (!confirmed) return;
    setBusy("generate");
    setError("");
    try {
      const res = await fetch("/api/closing/annual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, profitAccountNumber, lossAccountNumber }),
      });
      const data = await res.json();
      setReport(data);
      if (!res.ok) throw new Error(data.error || "Generation impossible");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cloture annuelle</h1>
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Acces reserve aux roles comptables autorises.
        </div>
      </main>
    );
  }

  const canGenerate =
    report &&
    Math.abs(report?.totals?.ledgerDiff || 0) < 0.01 &&
    !report.existingOpening &&
    report.existingClosing?.status !== "CLOSED" &&
    !report.anomalies?.length &&
    (report?.opening?.rows?.length || 0) > 0;
  const closingRecord = report?.generated?.fiscalYearClosing || report?.existingClosing;
  const openingJournal =
    report?.generated?.journalEntry || report?.existingClosing?.openingJournalEntry || report?.existingOpening;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Cloture annuelle</h1>
        <p className="mt-1 text-sm text-gray-600">
          Controle de l'exercice, simulation puis generation des a-nouveaux de l'exercice suivant.
        </p>
      </div>

      <section className="mt-5 border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-gray-700">
            Exercice a cloturer
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Compte resultat beneficiaire
            <input
              value={profitAccountNumber}
              onChange={(event) => setProfitAccountNumber(event.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Compte resultat deficitaire
            <input
              value={lossAccountNumber}
              onChange={(event) => setLossAccountNumber(event.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={control}
              disabled={!!busy}
              className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Controler
            </button>
            <button
              type="button"
              onClick={generateOpening}
              disabled={!!busy || !canGenerate}
              className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Generer N+1
            </button>
          </div>
        </div>
        {busy && <div className="mt-3 text-sm text-gray-500">Traitement...</div>}
        {error && (
          <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      {report && (
        <section className="mt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="border border-gray-200 p-3">
              <div className="text-xs uppercase text-gray-500">Periode</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {dateOnly(report.range?.start)} - {dateOnly(report.range?.end)}
              </div>
            </div>
            <div className="border border-gray-200 p-3">
              <div className="text-xs uppercase text-gray-500">Debit / credit</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {fmt(report.totals?.totalDebit)} / {fmt(report.totals?.totalCredit)}
              </div>
            </div>
            <div className="border border-gray-200 p-3">
              <div className="text-xs uppercase text-gray-500">Resultat</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {fmt(report.totals?.result)}
              </div>
            </div>
            <div className="border border-gray-200 p-3">
              <div className="text-xs uppercase text-gray-500">A-nouveaux</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {report.generated?.journalEntry?.number || report.existingOpening?.number || "Non generes"}
              </div>
            </div>
          </div>

          {!!report.anomalies?.length && (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium">Points a traiter</div>
              <ul className="mt-2 list-disc pl-5">
                {report.anomalies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-900">Impôt société et affectation AGO</h2>
              <p className="mt-1 text-sm text-slate-600">
                Cette étape calcule l'IS ou l'impôt minimum, puis prépare l'affectation du résultat net selon la décision AGO.
              </p>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-5">
                {[
                  ["corporateTaxRate", "Taux IS", "0.30"],
                  ["minimumTaxRate", "Impôt minimum", "0.01"],
                  ["legalReserveRate", "Réserve légale", "0.10"],
                  ["legalReserveCapRate", "Plafond réserve", "0.20"],
                  ["irmRate", "IRM dividendes", "0.20"],
                ].map(([field, label, placeholder]) => (
                  <label key={field} className="text-sm font-medium text-gray-700">
                    {label}
                    <input
                      value={allocationForm[field]}
                      onChange={(event) => setAllocationField(field, event.target.value)}
                      placeholder={placeholder}
                      className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">
                  Réserves statutaires
                  <input
                    type="number"
                    step="0.01"
                    value={allocationForm.statutoryReserveAmount}
                    onChange={(event) => setAllocationField("statutoryReserveAmount", event.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Réserves facultatives
                  <input
                    type="number"
                    step="0.01"
                    value={allocationForm.optionalReserveAmount}
                    onChange={(event) => setAllocationField("optionalReserveAmount", event.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Dividendes bruts
                  <input
                    type="number"
                    step="0.01"
                    value={allocationForm.dividendsGrossAmount}
                    onChange={(event) => setAllocationField("dividendsGrossAmount", event.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["taxExpenseAccountNumber", "Compte charge IS"],
                  ["minimumTaxExpenseAccountNumber", "Compte impôt minimum"],
                  ["taxPayableAccountNumber", "Compte IS à payer"],
                  ["legalReserveAccountNumber", "Compte réserve légale"],
                  ["statutoryReserveAccountNumber", "Compte réserve statutaire"],
                  ["optionalReserveAccountNumber", "Compte réserve facultative"],
                  ["retainedEarningsAccountNumber", "Compte RAN créditeur"],
                  ["lossRetainedAccountNumber", "Compte RAN débiteur"],
                  ["dividendsPayableAccountNumber", "Compte dividendes à payer"],
                  ["irmPayableAccountNumber", "Compte IRM à reverser"],
                ].map(([field, label]) => (
                  <label key={field} className="text-sm font-medium text-gray-700">
                    {label}
                    <input
                      value={allocationForm[field]}
                      onChange={(event) => setAllocationField(field, event.target.value)}
                      className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
                <label className="text-sm font-medium text-gray-700">
                  Référence AGO
                  <input
                    value={allocationForm.agoReference}
                    onChange={(event) => setAllocationField("agoReference", event.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Date AGO
                  <input
                    type="date"
                    value={allocationForm.decisionDate}
                    onChange={(event) => setAllocationField("decisionDate", event.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={simulateAllocation}
                  disabled={!!busy}
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Simuler fiscalité / AGO
                </button>
                <button
                  type="button"
                  onClick={approveAllocation}
                  disabled={!!busy || !allocationReport?.ok}
                  className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Valider fiscalité / AGO
                </button>
              </div>
              {allocationReport && (
                <div className="space-y-3">
                  {!!allocationReport.anomalies?.length && (
                    <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <div className="font-medium">Anomalies affectation</div>
                      <ul className="mt-1 list-disc pl-5">
                        {allocationReport.anomalies.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      ["CA annuel", allocationReport.result?.turnover],
                      ["Résultat avant impôt", allocationReport.result?.preTaxResult],
                      ["Impôt société", allocationReport.result?.corporateTaxAmount],
                      ["Résultat net", allocationReport.result?.netResult],
                      ["RAN débiteur apuré", allocationReport.result?.priorDebitRetainedEarnings],
                      ["Réserve légale", allocationReport.result?.legalReserveAmount],
                      ["Bénéfice distribuable", allocationReport.result?.distributableProfit],
                      ["Report à nouveau final", allocationReport.result?.retainedEarningsAmount],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-slate-200 p-3">
                        <div className="text-xs uppercase text-slate-500">{label}</div>
                        <div className="mt-1 font-semibold text-slate-900">{fmt(value)}</div>
                      </div>
                    ))}
                  </div>
                  {allocationReport.dividendLines?.length ? (
                    <div className="overflow-auto border rounded">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Associé</th>
                            <th className="px-3 py-2 text-right">Base</th>
                            <th className="px-3 py-2 text-right">Dividende brut</th>
                            <th className="px-3 py-2 text-right">IRM</th>
                            <th className="px-3 py-2 text-right">Net à payer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allocationReport.dividendLines.map((line) => (
                            <tr key={line.shareholderId}>
                              <td className="px-3 py-2">{line.shareholderName}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmt(line.basisAmount)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmt(line.grossDividend)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmt(line.irmAmount)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{fmt(line.netDividend)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {closingRecord && (
            <div className="border border-emerald-200 bg-emerald-50">
              <div className="border-b border-emerald-200 px-4 py-3">
                <h2 className="font-semibold text-emerald-950">Fiche de cloture</h2>
                <p className="mt-1 text-sm text-emerald-800">
                  Cette fiche confirme que l'exercice est verrouille et relie au journal d'a-nouveaux.
                </p>
              </div>
              <dl className="grid gap-0 text-sm md:grid-cols-3">
                <div className="border-b border-emerald-100 px-4 py-3 md:border-r">
                  <dt className="text-xs uppercase text-emerald-700">Statut</dt>
                  <dd className="mt-1 font-semibold text-emerald-950">
                    {closingStatusLabel(closingRecord.status)}
                  </dd>
                </div>
                <div className="border-b border-emerald-100 px-4 py-3 md:border-r">
                  <dt className="text-xs uppercase text-emerald-700">Exercice</dt>
                  <dd className="mt-1 font-semibold text-emerald-950">{closingRecord.year}</dd>
                </div>
                <div className="border-b border-emerald-100 px-4 py-3">
                  <dt className="text-xs uppercase text-emerald-700">Cloture creee le</dt>
                  <dd className="mt-1 font-semibold text-emerald-950">
                    {dateTime(closingRecord.closedAt)}
                  </dd>
                </div>
                <div className="border-b border-emerald-100 px-4 py-3 md:border-r">
                  <dt className="text-xs uppercase text-emerald-700">Periode verrouillee</dt>
                  <dd className="mt-1 font-semibold text-emerald-950">
                    {dateOnly(closingRecord.startDate)} - {dateOnly(closingRecord.endDate)}
                  </dd>
                </div>
                <div className="border-b border-emerald-100 px-4 py-3 md:border-r">
                  <dt className="text-xs uppercase text-emerald-700">Date d'a-nouveaux</dt>
                  <dd className="mt-1 font-semibold text-emerald-950">
                    {dateOnly(closingRecord.openingDate)}
                  </dd>
                </div>
                <div className="border-b border-emerald-100 px-4 py-3">
                  <dt className="text-xs uppercase text-emerald-700">Journal d'a-nouveaux</dt>
                  <dd className="mt-1 font-semibold text-emerald-950">
                    {openingJournal?.id ? (
                      <a
                        href={`/journal/${openingJournal.id}`}
                        className="text-emerald-900 underline underline-offset-2"
                      >
                        {openingJournal.number || openingJournal.id}
                      </a>
                    ) : (
                      openingJournal?.number || "Non reference"
                    )}
                  </dd>
                </div>
                <div className="px-4 py-3 md:col-span-3">
                  <dt className="text-xs uppercase text-emerald-700">Note</dt>
                  <dd className="mt-1 font-medium text-emerald-950">
                    {closingRecord.note || "Cloture annuelle et generation des a-nouveaux."}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="font-semibold text-gray-900">Simulation des a-nouveaux</h2>
              <p className="mt-1 text-sm text-gray-600">
                Comptes de bilan classes 1 a 5 reportes au {dateOnly(report.opening?.date)}.
              </p>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Compte</th>
                    <th className="px-3 py-2">Libelle</th>
                    <th className="px-3 py-2 text-right">Solde</th>
                    <th className="px-3 py-2">Sens</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(report.opening?.rows || []).slice(0, 200).map((row) => (
                    <tr key={row.accountId}>
                      <td className="px-3 py-2 font-mono">{row.number}</td>
                      <td className="px-3 py-2">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.net)}</td>
                      <td className="px-3 py-2">{row.direction}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(row.amount)}</td>
                    </tr>
                  ))}
                  {report.opening?.result?.amount > 0 && (
                    <tr className="bg-emerald-50">
                      <td className="px-3 py-2 font-mono">
                        {report.opening.result.accountNumber}
                      </td>
                      <td className="px-3 py-2">Resultat de l'exercice</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(report.totals?.balanceNet)}</td>
                      <td className="px-3 py-2">{report.opening.result.direction}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(report.opening.result.amount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
