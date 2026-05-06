import Link from "next/link";
import { TransactionLetterStatus, TransactionDirection } from "@prisma/client";
import { getLedgerData } from "@/lib/ledger/ledgerService";
import { validateLedgerFilters } from "@/lib/ledger/ledgerFilters";
import {
  formatAmount,
  formatPercent,
  buildQueryString
} from "@/lib/ledger/ledgerCalculations";
import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";
import LedgerTable from "@/components/LedgerTable";

const letterStatusOptions = Object.keys(TransactionLetterStatus);
const directionOptions = Object.keys(TransactionDirection);

export default async function LedgerPage(props) {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) {
    return (
      <div className="px-6 py-8">
        <p className="text-sm text-neutral-500">
          companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).
        </p>
      </div>
    );
  }

  const resolvedSearchParams = await props.searchParams;
  const rawFilters = resolvedSearchParams ?? {};

  // Validation des filtres avec Zod
  const filters = validateLedgerFilters(rawFilters);

  // Récupération des données via le service
  const { accounts, totals } = await getLedgerData(companyId, filters);

  const baseQuery = {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    q: filters.q,
    letterStatus: filters.letterStatus,
    direction: filters.direction,
    includeZero: filters.includeZero ? "true" : "false",
  };

  if (!accounts.length) {
    return (
      <div className="px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Grand livre</h1>
            <p className="text-sm text-neutral-500">0 compte affiché</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link className="text-blue-600 hover:underline" href={`/api/ledger${buildQueryString(baseQuery)}`} target="_blank" rel="noopener noreferrer">Export JSON</Link>
            <Link className="text-blue-600 hover:underline" href={`/api/ledger${buildQueryString(baseQuery, { format: "csv" })}`} target="_blank" rel="noopener noreferrer">Export CSV</Link>
            <Link className="text-blue-600 hover:underline" href={`/trial-balance${buildQueryString({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, includeZero: filters.includeZero ? "true" : "false" })}`}>Balance générale</Link>
          </div>
        </div>
        <form className="grid gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4" action="/ledger" method="get">
          <div className="grid gap-4 md:grid-cols-6">
            <label className="flex flex-col text-sm"><span className="mb-1 font-medium">Date début</span><input className="rounded border border-neutral-300 px-2 py-1" type="date" name="dateFrom" defaultValue={filters.dateFrom} /></label>
            <label className="flex flex-col text-sm"><span className="mb-1 font-medium">Date fin</span><input className="rounded border border-neutral-300 px-2 py-1" type="date" name="dateTo" defaultValue={filters.dateTo} /></label>
            <label className="flex flex-col text-sm"><span className="mb-1 font-medium">Lettrage</span><select className="rounded border border-neutral-300 px-2 py-1" name="letterStatus" defaultValue={filters.letterStatus}><option value="">Tous</option>{Object.keys(TransactionLetterStatus).map((option) => (<option key={option} value={option}>{option}</option>))}</select></label>
            <label className="flex flex-col text-sm"><span className="mb-1 font-medium">Sens</span><select className="rounded border border-neutral-300 px-2 py-1" name="direction" defaultValue={filters.direction}><option value="">Débit + Crédit</option>{Object.keys(TransactionDirection).map((option) => (<option key={option} value={option}>{option}</option>))}</select></label>
            <label className="flex flex-col text-sm md:col-span-2"><span className="mb-1 font-medium">Recherche</span><input className="rounded border border-neutral-300 px-2 py-1" type="text" name="q" placeholder="Compte, libellé, journal, pièce" defaultValue={filters.q} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col text-sm"><span className="mb-1 font-medium">Comptes à zéro</span><select className="rounded border border-neutral-300 px-2 py-1" name="includeZero" defaultValue={filters.includeZero ? "true" : "false"}><option value="true">Inclure</option><option value="false">Exclure</option></select></label>
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Filtrer</button>
            <Link className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100" href="/ledger">Réinitialiser</Link>
          </div>
        </form>
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-neutral-500">Aucun compte ne correspond à ces filtres.</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grand livre</h1>
          <p className="text-sm text-neutral-500">
            {accounts.length} comptes affichés • Débit {formatAmount(totals.totalDebit)} •
            Crédit {formatAmount(totals.totalCredit)}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link
            className="text-blue-600 hover:underline"
            href={`/api/ledger${buildQueryString(baseQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Export JSON
          </Link>
          <Link
            className="text-blue-600 hover:underline"
            href={`/api/ledger${buildQueryString(baseQuery, { format: "csv" })}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Export CSV
          </Link>
          <Link
            className="text-blue-600 hover:underline"
            href={`/trial-balance${buildQueryString({
              dateFrom: filters.dateFrom,
              dateTo: filters.dateTo,
              includeZero: filters.includeZero ? "true" : "false",
            })}`}
          >
            Balance générale
          </Link>
        </div>
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
              defaultValue={filters.dateFrom}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Date fin</span>
            <input
              className="rounded border border-neutral-300 px-2 py-1"
              type="date"
              name="dateTo"
              defaultValue={filters.dateTo}
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Lettrage</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="letterStatus"
              defaultValue={filters.letterStatus}
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
              defaultValue={filters.direction}
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
              placeholder="Compte, libellé, journal, pièce"
              defaultValue={filters.q}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Comptes à zéro</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1"
              name="includeZero"
              defaultValue={filters.includeZero ? "true" : "false"}
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
            {formatAmount(totals.totalDebit)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Crédit</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            {formatAmount(totals.totalCredit)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Lettré</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {formatAmount(totals.totalLettered)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-neutral-500">Reste à lettrer</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">
            {formatAmount(totals.totalOutstanding)}
          </p>
        </div>
      </div>

      <LedgerTable
        items={accounts}
        totals={totals}
        baseQuery={baseQuery}
      />
    </div>
  );
}
