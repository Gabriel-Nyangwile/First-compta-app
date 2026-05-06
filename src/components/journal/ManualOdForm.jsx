"use client";

import { useMemo, useState } from "react";
import { can, getClientRole } from "@/lib/clientRbac";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine() {
  return {
    accountId: "",
    description: "",
    debit: "",
    credit: "",
  };
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export default function ManualOdForm({
  accounts,
  initialData = null,
  mode = "create",
}) {
  const role = getClientRole();
  const canPrepare = can("postJournalEntry", role);
  const canValidate = can("reopenPeriod", role);
  const [date, setDate] = useState(initialData?.date || todayValue());
  const [description, setDescription] = useState(initialData?.description || "");
  const [supportRef, setSupportRef] = useState(initialData?.supportRef || "");
  const [lines, setLines] = useState(
    initialData?.lines?.length
      ? initialData.lines
      : [emptyLine(), emptyLine()]
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdEntry, setCreatedEntry] = useState(null);
  const [submitMode, setSubmitMode] = useState(mode === "edit" ? initialData?.status || "POSTED" : "POSTED");

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        acc.debit += parseAmount(line.debit);
        acc.credit += parseAmount(line.credit);
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [lines]);

  function updateLine(index, field, value) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [field]: value };
        if (field === "debit" && value) next.credit = "";
        if (field === "credit" && value) next.debit = "";
        return next;
      })
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(index) {
    setLines((current) =>
      current.length <= 2 ? current : current.filter((_, lineIndex) => lineIndex !== index)
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const requestedStatus =
      event.nativeEvent?.submitter?.value ||
      submitMode ||
      (mode === "edit" ? initialData?.status || "POSTED" : "POSTED");
    setError("");
    setCreatedEntry(null);
    setSubmitMode(requestedStatus);
    setSubmitting(true);

    try {
      const endpoint =
        mode === "edit" && initialData?.id
          ? `/api/journal-entries/manual/${initialData.id}`
          : "/api/journal-entries/manual";
      const method = mode === "edit" ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description,
          supportRef,
          status: requestedStatus,
          lines,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (mode === "edit"
              ? "Erreur mise à jour OD manuelle"
              : "Erreur création OD manuelle")
        );
      }
      setCreatedEntry(payload);
      setSubmitMode(payload.status || submitMode);
      if (mode === "create") {
        setDescription("");
        setSupportRef("");
        setLines([emptyLine(), emptyLine()]);
      }
    } catch (submitError) {
      setError(
        submitError.message ||
          (mode === "edit"
            ? "Erreur mise à jour OD manuelle"
            : "Erreur création OD manuelle")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initialData?.id) return;
    if (!window.confirm("Supprimer cette OD manuelle ?")) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/journal-entries/manual/${initialData.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur suppression OD manuelle");
      }
      window.location.href = "/journal";
    } catch (deleteError) {
      setError(deleteError.message || "Erreur suppression OD manuelle");
      setSubmitting(false);
    }
  }

  const balanced = Math.abs(totals.debit - totals.credit) < 0.01;

  return (
    <div className="space-y-6">
      <form
        className="space-y-6 rounded-xl border border-neutral-200 bg-white p-5"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Date</span>
            <input
              className="rounded border border-neutral-300 px-3 py-2"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Description de l'opération</span>
            <input
              className="rounded border border-neutral-300 px-3 py-2"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex. Régularisation compte d'attente"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Pièce justificative / Référence externe</span>
            <input
              className="rounded border border-neutral-300 px-3 py-2"
              type="text"
              value={supportRef}
              onChange={(event) => setSupportRef(event.target.value)}
              placeholder="Ex. OD-REG-2026-04, PV-01, BORD-125"
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Compte</th>
                <th className="px-3 py-2 text-left font-semibold">Libellé ligne</th>
                <th className="px-3 py-2 text-right font-semibold">Débit</th>
                <th className="px-3 py-2 text-right font-semibold">Crédit</th>
                <th className="px-3 py-2 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {lines.map((line, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 align-top">
                    <select
                      className="w-full rounded border border-neutral-300 px-2 py-2"
                      value={line.accountId}
                      onChange={(event) =>
                        updateLine(index, "accountId", event.target.value)
                      }
                      required
                    >
                      <option value="">Sélectionner un compte</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.number} - {account.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full rounded border border-neutral-300 px-2 py-2"
                      type="text"
                      value={line.description}
                      onChange={(event) =>
                        updateLine(index, "description", event.target.value)
                      }
                      placeholder="Libellé de ligne"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full rounded border border-neutral-300 px-2 py-2 text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={(event) =>
                        updateLine(index, "debit", event.target.value)
                      }
                      placeholder="0,00"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      className="w-full rounded border border-neutral-300 px-2 py-2 text-right"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={(event) =>
                        updateLine(index, "credit", event.target.value)
                      }
                      placeholder="0,00"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-center">
                    <button
                      className="rounded border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
                      type="button"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-neutral-50">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-right font-semibold">
                  Totaux
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {totals.debit.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {totals.credit.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td
                  className={`px-3 py-2 text-center text-xs font-semibold ${
                    balanced ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {balanced ? "Équilibrée" : "Non équilibrée"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            type="button"
            onClick={addLine}
            disabled={!canPrepare}
          >
            Ajouter une ligne
          </button>
          <button
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
            type="submit"
            disabled={submitting || !canPrepare}
            name="status"
            value="DRAFT"
            formNoValidate
          >
            {submitting && submitMode === "DRAFT"
              ? "Enregistrement..."
              : "Enregistrer en brouillon"}
          </button>
          {canValidate ? (
            <button
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              type="submit"
              disabled={submitting}
              name="status"
              value="POSTED"
            >
              {submitting
                ? "Enregistrement..."
                : mode === "edit"
                  ? "Valider / publier l'OD"
                  : "Valider l'OD"}
            </button>
          ) : null}
          {mode === "edit" ? (
            <button
              className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
              type="button"
              onClick={handleDelete}
              disabled={submitting || (initialData?.status === "POSTED" && !canValidate)}
            >
              Supprimer l'OD
            </button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-xs text-neutral-500">
          Rôle actif : {role}. Préparation en brouillon : comptable ou plus. Validation / publication : responsable finance ou superadmin.
        </p>
      </form>

      {createdEntry ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">
            OD manuelle {mode === "edit" ? "mise à jour" : "créée"} : {createdEntry.number}
          </p>
          <p>Statut : {createdEntry.status}</p>
          <p>Référence justificative : {createdEntry.supportRef || "—"}</p>
          <p>
            {createdEntry.lineCount} lignes • total débit{" "}
            {Number(createdEntry.totalDebit).toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            • total crédit{" "}
            {Number(createdEntry.totalCredit).toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <a
            className="mt-2 inline-flex text-blue-700 underline"
            href={`/journal/${createdEntry.id}`}
          >
            Ouvrir l'écriture
          </a>
        </div>
      ) : null}
    </div>
  );
}
