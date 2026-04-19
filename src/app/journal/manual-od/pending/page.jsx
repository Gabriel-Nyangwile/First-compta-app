import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAmount(value) {
  const num = Number(value || 0);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function summarizeDraft(entry) {
  const lines = Array.isArray(entry.draftPayload?.lines) ? entry.draftPayload.lines : [];
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.debit || 0);
    credit += Number(line.credit || 0);
  }
  return {
    lineCount: lines.length,
    debit,
    credit,
    balanced: Math.abs(debit - credit) < 0.001,
  };
}

export default async function PendingManualOdPage() {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);

  if (!companyId) {
    return (
      <div className="px-6 py-8">
        companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).
      </div>
    );
  }

  const entries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      sourceType: "MANUAL",
      status: "DRAFT",
      sourceId: { startsWith: "manual-od:" },
    },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    include: {
      preparedByUser: { select: { id: true, username: true, email: true } },
      validatedByUser: { select: { id: true, username: true, email: true } },
    },
  });

  const rows = entries.map((entry) => ({
    ...entry,
    draft: summarizeDraft(entry),
  }));

  const balancedCount = rows.filter((row) => row.draft.balanced).length;
  const unbalancedCount = rows.length - balancedCount;

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            OD manuelles en attente de validation
          </h1>
          <p className="text-sm text-neutral-500">
            {rows.length} brouillon{rows.length > 1 ? "s" : ""} • {balancedCount} équilibré{balancedCount > 1 ? "s" : ""} • {unbalancedCount} à corriger
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal/manual-od"
          >
            Nouvelle OD manuelle
          </Link>
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal"
          >
            Retour journal
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Cet écran centralise les brouillons d&apos;OD manuelle. Une OD brouillon
        n&apos;impacte pas les soldes comptables tant qu&apos;elle n&apos;est pas
        publiée.
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Journal</th>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-3 py-2 text-left font-semibold">PJ</th>
              <th className="px-3 py-2 text-left font-semibold">Préparé par</th>
              <th className="px-3 py-2 text-right font-semibold">Débit</th>
              <th className="px-3 py-2 text-right font-semibold">Crédit</th>
              <th className="px-3 py-2 text-center font-semibold">Lignes</th>
              <th className="px-3 py-2 text-center font-semibold">Équilibre</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {rows.map((entry) => (
              <tr key={entry.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col">
                    <Link
                      className="font-semibold text-blue-600 hover:underline"
                      href={`/journal/${entry.id}`}
                    >
                      {entry.number}
                    </Link>
                    <span className="text-xs text-neutral-500">
                      {entry.sourceId}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-neutral-700">
                  {formatDateTime(entry.date)}
                </td>
                <td className="px-3 py-2 align-top text-neutral-700">
                  {entry.description || "—"}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs text-neutral-600">
                  {entry.supportRef || "—"}
                </td>
                <td className="px-3 py-2 align-top text-neutral-700">
                  <div>{entry.preparedByUser?.username || entry.preparedByUser?.email || "—"}</div>
                  <div className="text-xs text-neutral-500">
                    {formatDateTime(entry.preparedAt)}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-right font-mono">
                  {formatAmount(entry.draft.debit)}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono">
                  {formatAmount(entry.draft.credit)}
                </td>
                <td className="px-3 py-2 align-top text-center text-neutral-600">
                  {entry.draft.lineCount}
                </td>
                <td className="px-3 py-2 align-top text-center">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      entry.draft.balanced
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {entry.draft.balanced ? "Prête" : "À corriger"}
                  </span>
                </td>
                <td className="px-3 py-2 align-top text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
                      href={`/journal/manual-od/${entry.id}`}
                    >
                      Revoir
                    </Link>
                    <Link
                      className="rounded border border-blue-300 px-3 py-1 text-blue-700 hover:bg-blue-50"
                      href={`/journal/${entry.id}`}
                    >
                      Détail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-neutral-500">
                  Aucun brouillon d&apos;OD manuelle en attente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
