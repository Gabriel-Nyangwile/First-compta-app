"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { can, getClientRole } from "@/lib/clientRbac";

export default function JournalEntryReverseButton({ entryId, entryNumber }) {
  const router = useRouter();
  const role = getClientRole();
  const canReverse = can("reopenPeriod", role);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reverseEntry() {
    if (!entryId || loading) return;
    const ok = window.confirm(`Annuler l'écriture ${entryNumber} par contrepassation ?`);
    if (!ok) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/journal-entries/${entryId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Erreur annulation OD");
      }
      router.push(`/journal/${payload.reversal.id}`);
      router.refresh();
    } catch (reverseError) {
      setError(reverseError.message || "Erreur annulation OD");
    } finally {
      setLoading(false);
    }
  }

  if (!canReverse) return null;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-2">
        <input
          className="w-36 rounded border border-neutral-300 px-2 py-1 text-sm"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          disabled={loading}
        />
        <button
          className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={reverseEntry}
          disabled={loading || !date}
        >
          {loading ? "Annulation..." : "Annuler l'OD"}
        </button>
      </div>
      {error ? <span className="max-w-xs text-right text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
