import Link from "next/link";
import { TransactionDirection, TransactionLetterStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

const formatAmount = (value) => {
  const num = toNumber(value);
  if (!num) return "0,00";
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
};

const formatDateTime = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const buildQuery = (current, overrides = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value == null) continue;
    if (value === "") continue;
    params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

const letterStatusOptions = Object.keys(TransactionLetterStatus);
const directionOptions = Object.keys(TransactionDirection);

export default async function LedgerAccountPage(props) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;

  const { accountId } = resolvedParams || {};
  const searchParams = resolvedSearchParams ?? {};

  if (!accountId) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-neutral-500">
          Paramètre de compte manquant.
        </p>
        <Link
          className="mt-4 inline-flex text-sm text-blue-600 hover:underline"
          href="/ledger"
        >
          Retour au grand livre
        </Link>
      </div>
    );
  }

  const page = Math.max(1, Number.parseInt(searchParams?.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(10, Number.parseInt(searchParams?.pageSize ?? "50", 10) || 50)
  );
  const dateFrom = searchParams?.dateFrom ?? "";
  const dateTo = searchParams?.dateTo ?? "";
  const letterStatus = searchParams?.letterStatus ?? "";
  const direction = searchParams?.direction ?? "";
  const q = searchParams?.q ?? "";

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, number: true, label: true },
  });

  if (!account) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-neutral-500">Compte introuvable.</p>
        <Link
          className="mt-4 inline-flex text-sm text-blue-600 hover:underline"
          href="/ledger"
        >
          Retour au grand livre
        </Link>
      </div>
    );
  }

  const filters = [{ accountId }];
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
  if (q) {
    const like = { contains: q, mode: "insensitive" };
    filters.push({
      OR: [
        { description: like },
        { letterRef: like },
        { journalEntry: { number: like } },
        { journalEntry: { sourceId: like } },
        { invoice: { invoiceNumber: like } },
        { incomingInvoice: { entryNumber: like } },
        { client: { name: like } },
        { supplier: { name: like } },
        { moneyMovement: { voucherRef: like } },
      ],
    });
  }

  const where = { AND: filters };

  const [totalCount, transactions, aggregates, statusCounters] =
    await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          journalEntry: {
            select: {
              id: true,
              number: true,
              date: true,
              sourceType: true,
              sourceId: true,
            },
          },
          client: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          incomingInvoice: { select: { id: true, entryNumber: true } },
          moneyMovement: {
            select: { id: true, voucherRef: true, kind: true },
          },
        },
      }),
      prisma.transaction.groupBy({
        where,
        by: ["direction"],
        _sum: { amount: true, letteredAmount: true },
      }),
      prisma.transaction.groupBy({
        where,
        by: ["letterStatus"],
        _count: { letterStatus: true },
      }),
    ]);

  const rows = transactions.map((tx) => {
    const amount = toNumber(tx.amount);
    const letteredAmount = toNumber(tx.letteredAmount);
    const outstanding = Math.max(0, amount - letteredAmount);
    return {
      ...tx,
      amount,
      debit: tx.direction === "DEBIT" ? amount : 0,
      credit: tx.direction === "CREDIT" ? amount : 0,
      letteredAmount,
      outstanding,
      letterStatus: tx.letterStatus || "UNMATCHED",
    };
  });

  let pageDebit = 0;
  let pageCredit = 0;
  let pageLettered = 0;
  let pageOutstanding = 0;
  rows.forEach((row) => {
    pageDebit += row.debit;
    pageCredit += row.credit;
    pageLettered += row.letteredAmount;
    pageOutstanding += row.outstanding;
  });

  let totalDebit = 0;
  let totalCredit = 0;
  let totalLettered = 0;
  let totalOutstanding = 0;
  aggregates.forEach((item) => {
    const amount = toNumber(item._sum.amount);
    const letteredAmount = toNumber(item._sum.letteredAmount);
    if (item.direction === "DEBIT") totalDebit += amount;
    else totalCredit += amount;
    totalLettered += letteredAmount;
    totalOutstanding += Math.max(0, amount - letteredAmount);
  });

  const letterStatusCounts = Object.fromEntries(
    statusCounters.map((item) => [
      item.letterStatus || "UNMATCHED",
      item._count.letterStatus,
    ])
  );
  const totalStatusCount = Object.values(letterStatusCounts).reduce(
    (acc, value) => acc + value,
    0
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const baseParams = {
    page: String(page),
    pageSize: String(pageSize),
    dateFrom,
    dateTo,
    letterStatus,
    direction,
    q,
  };

  const prevQuery = buildQuery(baseParams, {
    page: Math.max(1, page - 1),
  });
  const nextQuery = buildQuery(baseParams, {
    page: Math.min(totalPages, page + 1),
  });

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Compte {account.number}
          </h1>
          <p className="text-sm text-neutral-500">
            {account.label || "Sans libellé"}
          </p>
        </div>
        <Link
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          href="/ledger"
        >
          ← Retour grand livre
        </Link>
      </div>

      <form
        className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
        action={`/ledger/${account.id}`}
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
            <span className="mb-1 font-medium">Recherche</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="text"
              name="q"
              placeholder="Libellé, pièce, client…"
              defaultValue={q}
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-6">
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
              min={10}
              max={200}
              name="pageSize"
              defaultValue={pageSize}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filtrer
          </button>
          <Link
            className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            href={`/ledger/${account.id}`}
          >
            Réinitialiser
          </Link>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Débit cumulé</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            {formatAmount(totalDebit)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Crédit cumulé</p>
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

      <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase text-neutral-500">
          Répartition lettrage
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-neutral-600">
          {letterStatusOptions.map((status) => {
            const count = letterStatusCounts[status] ?? 0;
            if (!count) return null;
            return (
              <span
                key={status}
                className="rounded bg-neutral-100 px-2 py-1 font-medium"
              >
                {status} · {count}
                {totalStatusCount
                  ? ` (${Math.round((count / totalStatusCount) * 100)}%)`
                  : ""}
              </span>
            );
          })}
          {!totalStatusCount && <span>—</span>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Journal</th>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-3 py-2 text-left font-semibold">Relations</th>
              <th className="px-3 py-2 text-right font-semibold">Débit</th>
              <th className="px-3 py-2 text-right font-semibold">Crédit</th>
              <th className="px-3 py-2 text-left font-semibold">Lettrage</th>
              <th className="px-3 py-2 text-right font-semibold">Lettré</th>
              <th className="px-3 py-2 text-right font-semibold">Reste</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 align-top text-neutral-700">
                  {formatDate(row.date)}
                </td>
                <td className="px-3 py-2 align-top text-neutral-700">
                  {row.journalEntry ? (
                    <div className="flex flex-col">
                      <Link
                        className="font-medium text-blue-600 hover:underline"
                        href={`/journal/${row.journalEntry.id}`}
                      >
                        {row.journalEntry.number}
                      </Link>
                      <span className="text-xs text-neutral-500">
                        {row.journalEntry.sourceType}
                        {row.journalEntry.sourceId
                          ? ` • ${row.journalEntry.sourceId}`
                          : ""}
                      </span>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 align-top text-neutral-700">
                  <div className="font-medium">{row.description || "—"}</div>
                  <div className="text-xs text-neutral-400">{row.kind}</div>
                </td>
                <td className="px-3 py-2 align-top text-xs text-neutral-500 space-y-1">
                  {row.client && <div>Client : {row.client.name}</div>}
                  {row.supplier && <div>Fournisseur : {row.supplier.name}</div>}
                  {row.invoice && (
                    <div>
                      Facture :
                      <Link
                        className="ml-1 text-blue-600 hover:underline"
                        href={`/invoices/${row.invoice.id}`}
                      >
                        {row.invoice.invoiceNumber}
                      </Link>
                    </div>
                  )}
                  {row.incomingInvoice && (
                    <div>
                      Facture fournisseur :
                      <Link
                        className="ml-1 text-blue-600 hover:underline"
                        href={`/incoming-invoices/${row.incomingInvoice.id}`}
                      >
                        {row.incomingInvoice.entryNumber}
                      </Link>
                    </div>
                  )}
                  {row.moneyMovement && (
                    <div>
                      Mouvement trésorerie : {row.moneyMovement.voucherRef} (
                      {row.moneyMovement.kind})
                    </div>
                  )}
                  {!row.client &&
                    !row.supplier &&
                    !row.invoice &&
                    !row.incomingInvoice &&
                    !row.moneyMovement && <div>—</div>}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-emerald-600">
                  {row.debit ? formatAmount(row.debit) : ""}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-amber-600">
                  {row.credit ? formatAmount(row.credit) : ""}
                </td>
                <td className="px-3 py-2 align-top text-xs text-neutral-600">
                  <div className="font-medium">{row.letterStatus}</div>
                  <div>{row.letterRef || "—"}</div>
                  {row.letteredAt && (
                    <div>{formatDateTime(row.letteredAt)}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-emerald-700">
                  {row.letteredAmount ? formatAmount(row.letteredAmount) : ""}
                </td>
                <td className="px-3 py-2 align-top text-right font-mono text-amber-700">
                  {row.outstanding ? formatAmount(row.outstanding) : ""}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  className="px-3 py-6 text-center text-neutral-500"
                  colSpan={9}
                >
                  Aucune écriture sur cette plage.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-neutral-50">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                Totaux page
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(pageDebit)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(pageCredit)}
              </td>
              <td></td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                {formatAmount(pageLettered)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-amber-700">
                {formatAmount(pageOutstanding)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                Totaux filtrés
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalDebit)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatAmount(totalCredit)}
              </td>
              <td></td>
              <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                {formatAmount(totalLettered)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-amber-700">
                {formatAmount(totalOutstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-600">
        <p>
          Page {page} / {totalPages} • {rows.length} écritures affichées sur{" "}
          {totalCount}
        </p>
        <div className="flex gap-2">
          <Link
            className={`rounded border px-3 py-1 ${
              page === 1
                ? "cursor-not-allowed border-neutral-200 text-neutral-300"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
            href={page === 1 ? "#" : `/ledger/${account.id}${prevQuery}`}
            aria-disabled={page === 1}
          >
            Précédent
          </Link>
          <Link
            className={`rounded border px-3 py-1 ${
              page >= totalPages
                ? "cursor-not-allowed border-neutral-200 text-neutral-300"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            }`}
            href={
              page >= totalPages ? "#" : `/ledger/${account.id}${nextQuery}`
            }
            aria-disabled={page >= totalPages}
          >
            Suivant
          </Link>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <Link
          className="text-blue-600 hover:underline"
          href={`/api/ledger/${account.id}${buildQuery({
            dateFrom,
            dateTo,
            letterStatus,
            direction,
            q,
            format: "csv",
          })}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Export CSV
        </Link>
        <Link
          className="text-blue-600 hover:underline"
          href={`/api/ledger/${account.id}${buildQuery({
            dateFrom,
            dateTo,
            letterStatus,
            direction,
            q,
          })}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Voir JSON API
        </Link>
      </div>
    </div>
  );
}
