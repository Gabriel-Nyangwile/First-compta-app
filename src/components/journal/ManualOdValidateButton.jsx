"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { can, getClientRole } from "@/lib/clientRbac";

export default function ManualOdValidateButton({
  entryId,
  date,
  description,
  supportRef,
  lines,
  balanced,
  compact = false,
}) {
  const router = useRouter();
  const role = getClientRole();
  const canValidate = can("reopenPeriod", role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function validateDraft() {
    if (!entryId || loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/journal-entries/manual/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description,
          supportRef,
          status: "POSTED",
          lines,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur validation OD manuelle");
      }
      router.refresh();
    } catch (validationError) {
      setError(validationError.message || "Erreur validation OD manuelle");
    } finally {
      setLoading(false);
    }
  }

  if (!canValidate) {
    return (
      <span className="text-xs text-neutral-500">
        Validation réservée au responsable finance ou superadmin.
      </span>
    );
  }

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1" : "flex flex-col gap-2"}>
      <button
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        type="button"
        onClick={validateDraft}
        disabled={loading || !balanced}
        title={!balanced ? "L'OD doit être équilibrée avant validation" : ""}
      >
        {loading ? "Validation..." : "Valider / publier"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
