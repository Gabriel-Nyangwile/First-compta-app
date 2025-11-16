import Link from "next/link";
import {
  JournalSourceType,
  JournalStatus,
  TransactionLetterStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

const sourceOptions = Object.keys(JournalSourceType);
const statusOptions = Object.keys(JournalStatus);
const letterStatusOptions = Object.keys(TransactionLetterStatus);

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR").format(date);
};

const formatAmount = (value) => {
  const num = toNumber(value);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const buildQuery = (currentParams, overrides = {}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== "") {
      query.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") {
      query.delete(key);
      continue;
    }
    query.set(key, String(value));
  }
  return query.toString();
};

export default async function JournalPage({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(5, Number.parseInt(params?.pageSize ?? "20", 10) || 20)
  );
  const sourceType = params?.sourceType ?? "";
  const status = params?.status ?? "";
  const letterStatus = params?.letterStatus ?? "";
  const q = params?.q ?? "";
  const dateFrom = params?.dateFrom ?? "";
  const dateTo = params?.dateTo ?? "";

  const filters = [];
  if (sourceType) filters.push({ sourceType });
  if (status) filters.push({ status });
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    filters.push({ date: range });
  }

  if (letterStatus) {
    filters.push({ lines: { some: { letterStatus } } });
  }

  if (q) {
    const like = { contains: q, mode: "insensitive" };
    filters.push({
      OR: [
        { number: like },
        { description: like },
        { sourceId: like },
        {
          lines: {
            some: {
              OR: [
                { description: like },
                { letterRef: like },
                { account: { number: { contains: q } } },
                { account: { label: like } },
              ],
            },
          },
        },
      ],
    });
  }

  const where = filters.length ? { AND: filters } : undefined;
  const totalCount = await prisma.journalEntry.count({ where });

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      lines: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        include: {
          account: { select: { id: true, number: true, label: true } },
        },
      },
    },
  });

  const items = entries.map((entry) => {
    let debit = 0;
    let credit = 0;
    let lettered = 0;
    let outstanding = 0;
    entry.lines.forEach((line) => {
      const amount = toNumber(line.amount);
      const letteredAmount = toNumber(line.letteredAmount);
      const outstandingLine = Math.max(0, amount - letteredAmount);
      if (line.direction === "DEBIT") debit += amount;
      else credit += amount;
      lettered += letteredAmount;
      outstanding += outstandingLine;
    });
    return {
      id: entry.id,
      number: entry.number,
      date: entry.date,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      description: entry.description,
      status: entry.status,
      postedAt: entry.postedAt,
      debit,
      credit,
      balanced: Math.abs(debit - credit) < 0.001,
      lineCount: entry.lines.length,
      lettered,
      outstanding,
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const baseQuery = {
    sourceType,
    status,
    letterStatus,
    q,
    dateFrom,
    dateTo,
    pageSize: String(pageSize),
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Journal général
          </h1>
          <p className="text-sm text-neutral-500">
            {totalCount} écritures&nbsp;• page {page} sur {totalPages}
          </p>
        </div>
        <Link
          className="text-sm text-blue-600 hover:underline"
          href={`/api/journal-entries?${buildQuery(baseQuery, {
            page: 1,
            pageSize: 1000,
          })}`}
          target="_blank"
        >
          Export JSON
        </Link>
      </div>

      <form
        className="grid gap-4 rounded-lg border border-neutral-200 p-4 bg-neutral-50"
        action="/journal"
        method="get"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Date début</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Date fin</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="date"
              name="dateTo"
              defaultValue={dateTo}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Source</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="sourceType"
              defaultValue={sourceType}
            >
              <option value="">Toutes</option>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Statut</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="status"
              defaultValue={status}
            >
              <option value="">Tous</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Lettrage</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="letterStatus"
              defaultValue={letterStatus}
            >
              <option value="">Tous</option>
              {letterStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <label className="flex flex-col text-sm md:col-span-3">
            <span className="mb-1 font-medium">Recherche globale</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="text"
              name="q"
              placeholder="Numéro, libellé, pièce, compte…"
              defaultValue={q}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Page</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="number"
              min={1}
              name="page"
              defaultValue={page}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Taille page</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="number"
              min={5}
              max={100}
              name="pageSize"
              defaultValue={pageSize}
            />
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filtrer
          </button>
          <Link
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            href="/journal"
          >
            Réinitialiser
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Écriture</th>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Source</th>
              <th className="px-3 py-2 text-left font-semibold">Statut</th>
              <th className="px-3 py-2 text-right font-semibold">Débit</th>
              <th className="px-3 py-2 text-right font-semibold">Crédit</th>
              <th className="px-3 py-2 text-right font-semibold">Lettré</th>
              <th className="px-3 py-2 text-right font-semibold">Reste</th>
              <th className="px-3 py-2 text-right font-semibold">Lignes</th>
              <th className="px-3 py-2 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {items.map((entry) => {
              const balanceClass = entry.balanced
                ? "text-green-600"
                : "text-red-600";
              return (
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
                        {entry.sourceId || "—"}
                      </span>
                      {entry.description && (
                        <span className="text-xs text-neutral-600 mt-1 line-clamp-2">
                          {entry.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-neutral-700">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                      {entry.sourceType}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono">
                    {formatAmount(entry.debit)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono">
                    {formatAmount(entry.credit)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-emerald-600">
                    {formatAmount(entry.lettered)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-amber-600">
                    {formatAmount(entry.outstanding)}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-neutral-600">
                    {entry.lineCount}
                  </td>
                  <td
                    className={`px-3 py-2 align-top text-right font-medium ${balanceClass}`}
                  >
                    {entry.balanced ? "OK" : "Écart"}
                  </td>
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  Aucune écriture trouvée avec ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Affichage {items.length ? (page - 1) * pageSize + 1 : 0}–
          {(page - 1) * pageSize + items.length} sur {totalCount}
        </p>
        <div className="flex gap-2">
          <Link
            className={`rounded border px-3 py-1 text-sm ${
              page === 1
                ? "cursor-not-allowed text-neutral-300 border-neutral-200"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
            href={`/journal?${buildQuery(baseQuery, { page: page - 1 })}`}
            aria-disabled={page === 1}
          >
            Précédent
          </Link>
          <Link
            className={`rounded border px-3 py-1 text-sm ${
              page >= totalPages
                ? "cursor-not-allowed text-neutral-300 border-neutral-200"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
            href={`/journal?${buildQuery(baseQuery, { page: page + 1 })}`}
            aria-disabled={page >= totalPages}
          >
            Suivant
          </Link>
        </div>
      </div>
    </div>
  );
}
