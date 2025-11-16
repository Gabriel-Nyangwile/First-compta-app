import Link from "next/link";
import { TransactionLetterStatus, TransactionDirection } from "@prisma/client";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

const formatAmount = (value) => {
  const num = toNumber(value);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPercent = (value, total) => {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
};

const letterStatusOptions = Object.keys(TransactionLetterStatus);
const directionOptions = Object.keys(TransactionDirection);

const buildQuery = (current, overrides = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value == null) continue;
    if (value === "") continue;
    params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export default async function LedgerPage(props) {
  const resolvedSearchParams = await props.searchParams;
  const searchParams = resolvedSearchParams ?? {};

  const dateFrom = searchParams?.dateFrom ?? "";
  const dateTo = searchParams?.dateTo ?? "";
  const q = searchParams?.q ?? "";
  const letterStatus = searchParams?.letterStatus ?? "";
  const direction = searchParams?.direction ?? "";
  const includeZero = (searchParams?.includeZero ?? "true") !== "false";

  const filters = [];
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
  if (letterStatus) filters.push({ letterStatus });
  if (direction) filters.push({ direction });
  const where = filters.length ? { AND: filters } : undefined;

  const transactions = await prisma.transaction.findMany({
    where,
    include: {
      account: {
        select: { id: true, number: true, label: true },
      },
    },
  });

  const accountBuckets = new Map();
  const search = q.trim().toLowerCase();

  for (const tx of transactions) {
    const { account } = tx;
    const matchesSearch = search
      ? account.number.toLowerCase().includes(search) ||
        (account.label || "").toLowerCase().includes(search)
      : true;
    if (!matchesSearch) continue;

    if (!accountBuckets.has(account.id)) {
      accountBuckets.set(account.id, {
        account,
        debit: 0,
        credit: 0,
        letteredAmount: 0,
        outstandingAmount: 0,
        transactionCount: 0,
        statusBreakdown: {
          UNMATCHED: 0,
          PARTIAL: 0,
          MATCHED: 0,
        },
      });
    }

    const bucket = accountBuckets.get(account.id);
    const amount = toNumber(tx.amount);
    const letteredAmount = toNumber(tx.letteredAmount);
    const outstanding = Math.max(0, amount - letteredAmount);

    if (tx.direction === "DEBIT") bucket.debit += amount;
    else bucket.credit += amount;

    bucket.letteredAmount += letteredAmount;
    bucket.outstandingAmount += outstanding;
    bucket.transactionCount += 1;

    const statusKey = tx.letterStatus || "UNMATCHED";
    bucket.statusBreakdown[statusKey] =
      (bucket.statusBreakdown[statusKey] ?? 0) + 1;
  }

  let rows = [...accountBuckets.values()].sort((a, b) =>
    a.account.number.localeCompare(b.account.number)
  );

  if (!includeZero) {
    rows = rows.filter((row) => row.debit !== 0 || row.credit !== 0);
  }

  let totalDebit = 0;
  let totalCredit = 0;
  let totalLettered = 0;
  let totalOutstanding = 0;
  rows.forEach((row) => {
    totalDebit += row.debit;
    totalCredit += row.credit;
    totalLettered += row.letteredAmount;
    totalOutstanding += row.outstandingAmount;
  });

  const baseParams = {
    dateFrom,
    dateTo,
    q,
    letterStatus,
    direction,
    includeZero: includeZero ? "true" : "false",
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grand livre</h1>
          <p className="text-sm text-neutral-500">
            {rows.length} comptes affichés • Débit {formatAmount(totalDebit)} •
            Crédit {formatAmount(totalCredit)}
          </p>
        </div>
        <Link
          className="text-sm text-blue-600 hover:underline"
          href={`/api/ledger${buildQuery(baseParams)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Export JSON
        </Link>
      </div>

      <form
        className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
        action="/ledger"
        method="get"
      >
        <div className="grid gap-4 md:grid-cols-6">
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
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Sens</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="direction"
              defaultValue={direction}
            >
              <option value="">Débit + Crédit</option>
              {directionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm md:col-span-2">
            <span className="mb-1 font-medium">Recherche compte</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="text"
              name="q"
              placeholder="Numéro ou libellé"
              defaultValue={q}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Comptes à zéro</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="includeZero"
              defaultValue={includeZero ? "true" : "false"}
            >
              <option value="true">Inclure</option>
              <option value="false">Exclure</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filtrer
          </button>
          <Link
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            href="/ledger"
          >
            Réinitialiser
          </Link>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Débit</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            {formatAmount(totalDebit)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Crédit</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            {formatAmount(totalCredit)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Lettré</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {formatAmount(totalLettered)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Reste à lettrer</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">
            {formatAmount(totalOutstanding)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Compte</th>
              <th className="px-3 py-2 text-left font-semibold">Libellé</th>
              <th className="px-3 py-2 text-right font-semibold">Débit</th>
              <th className="px-3 py-2 text-right font-semibold">Crédit</th>
              <th className="px-3 py-2 text-right font-semibold">Solde</th>
              <th className="px-3 py-2 text-right font-semibold">Lettré</th>
              <th className="px-3 py-2 text-right font-semibold">Reste</th>
              <th className="px-3 py-2 text-left font-semibold">Lettrage</th>
              <th className="px-3 py-2 text-right font-semibold">Écritures</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {rows.map((row) => {
              const balance = row.debit - row.credit;
              const totalStatus = Object.values(row.statusBreakdown).reduce(
                (acc, value) => acc + value,
                0
              );

              return (
                <tr key={row.account.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 align-top font-mono text-sm">
                    {row.account.number}
                  </td>
                  <td className="px-3 py-2 align-top text-neutral-700">
                    <div className="font-medium">{row.account.label}</div>
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-neutral-700">
                    {formatAmount(row.debit)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-neutral-700">
                    {formatAmount(row.credit)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono font-semibold text-blue-700">
                    {formatAmount(balance)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-emerald-600">
                    {formatAmount(row.letteredAmount)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-amber-600">
                    {formatAmount(row.outstandingAmount)}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-neutral-600">
                    <div className="flex flex-wrap gap-1">
                      {letterStatusOptions.map((status) => {
                        const count = row.statusBreakdown[status] ?? 0;
                        if (!count) return null;
                        return (
                          <span
                            key={status}
                            className="rounded bg-neutral-100 px-2 py-1 font-medium"
                          >
                            {status} · {count}
                            {totalStatus
                              ? ` (${formatPercent(count, totalStatus)})`
                              : ""}
                          </span>
                        );
                      })}
                      {totalStatus === 0 && <span>—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-right text-neutral-500">
                    {row.transactionCount}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <Link
                      className="text-sm text-blue-600 hover:underline"
                      href={`/ledger/${row.account.id}${buildQuery({
                        dateFrom,
                        dateTo,
                        letterStatus,
                        direction,
                      })}`}
                    >
                      Détails
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td
                  className="px-3 py-6 text-center text-neutral-500"
                  colSpan={10}
                >
                  Aucun compte ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-neutral-50">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right font-semibold">
                Totaux
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalDebit)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalCredit)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalDebit - totalCredit)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                {formatAmount(totalLettered)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-amber-700">
                {formatAmount(totalOutstanding)}
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
