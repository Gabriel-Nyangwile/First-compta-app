import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

const formatAmount = (value) =>
  toNumber(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const buildQuery = (current, overrides = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export default async function TrialBalancePage({ searchParams }) {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);

  if (!companyId) {
    return (
      <div className="px-6 py-8 text-sm text-neutral-500">
        companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).
      </div>
    );
  }

  const params = await searchParams;
  const dateFrom = params?.dateFrom ?? "";
  const dateTo = params?.dateTo ?? "";
  const includeZero = (params?.includeZero ?? "true") !== "false";

  const accounts = await prisma.account.findMany({
    where: { companyId },
    select: { id: true, number: true, label: true },
    orderBy: { number: "asc" },
  });

  const filters = [{ companyId }];
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

  const where = filters.length ? { AND: filters } : undefined;
  const groups = await prisma.transaction.groupBy({
    where,
    by: ["accountId", "direction"],
    _sum: { amount: true },
  });

  const rowsMap = new Map(
    accounts.map((account) => [account.id, { account, debit: 0, credit: 0 }])
  );

  groups.forEach((group) => {
    const row = rowsMap.get(group.accountId);
    if (!row) return;
    const amount = toNumber(group._sum.amount);
    if (group.direction === "DEBIT") row.debit = amount;
    else if (group.direction === "CREDIT") row.credit = amount;
  });

  let rows = [...rowsMap.values()];
  if (!includeZero) {
    rows = rows.filter((row) => row.debit !== 0 || row.credit !== 0);
  }

  let totalDebit = 0;
  let totalCredit = 0;
  rows.forEach((row) => {
    totalDebit += row.debit;
    totalCredit += row.credit;
  });

  const baseParams = {
    dateFrom,
    dateTo,
    includeZero: includeZero ? "true" : "false",
  };

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Balance générale</h1>
          <p className="text-sm text-neutral-500">
            {rows.length} comptes • Débit {formatAmount(totalDebit)} • Crédit {formatAmount(totalCredit)}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link className="text-blue-600 hover:underline" href={`/api/trial-balance${buildQuery(baseParams)}`} target="_blank" rel="noopener noreferrer">
            Export JSON
          </Link>
          <Link className="text-blue-600 hover:underline" href={`/api/trial-balance${buildQuery(baseParams, { format: "csv" })}`} target="_blank" rel="noopener noreferrer">
            Export CSV
          </Link>
          <Link className="text-blue-600 hover:underline" href={`/api/trial-balance/pdf${buildQuery(baseParams)}`} target="_blank" rel="noopener noreferrer">
            Export PDF
          </Link>
        </div>
      </div>

      <form className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4" action="/trial-balance" method="get">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Date début</span>
            <input className="rounded border border-neutral-300 px-2 py-1" type="date" name="dateFrom" defaultValue={dateFrom} />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Date fin</span>
            <input className="rounded border border-neutral-300 px-2 py-1" type="date" name="dateTo" defaultValue={dateTo} />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Comptes à zéro</span>
            <select className="rounded border border-neutral-300 px-2 py-1" name="includeZero" defaultValue={includeZero ? "true" : "false"}>
              <option value="true">Inclure</option>
              <option value="false">Exclure</option>
            </select>
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Filtrer
          </button>
          <Link className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100" href="/trial-balance">
            Réinitialiser
          </Link>
          <Link className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100" href="/ledger">
            Retour grand livre
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Compte</th>
              <th className="px-3 py-2 text-left font-semibold">Libellé</th>
              <th className="px-3 py-2 text-right font-semibold">Débit</th>
              <th className="px-3 py-2 text-right font-semibold">Crédit</th>
              <th className="px-3 py-2 text-right font-semibold">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {rows.map((row) => {
              const balance = row.debit - row.credit;
              return (
                <tr key={row.account.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono">{row.account.number}</td>
                  <td className="px-3 py-2">{row.account.label}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatAmount(row.debit)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatAmount(row.credit)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{formatAmount(balance)}</td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  Aucune ligne de balance sur cette plage.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-neutral-50">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right font-semibold">Totaux</td>
              <td className="px-3 py-2 text-right font-semibold">{formatAmount(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-semibold">{formatAmount(totalCredit)}</td>
              <td className="px-3 py-2 text-right font-semibold">{formatAmount(totalDebit - totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}