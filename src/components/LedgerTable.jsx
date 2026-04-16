'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatAmount, formatPercent } from '@/lib/clientUtils';

const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
  NONE: null,
};

const SORTABLE_COLUMNS = {
  number: 'number',
  label: 'label',
  debit: 'debit',
  credit: 'credit',
  balance: 'balance',
  letteredAmount: 'letteredAmount',
  outstandingAmount: 'outstandingAmount',
  transactionCount: 'transactionCount',
};

export default function LedgerTable({ items, totals, baseQuery }) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState(SORT_DIRECTIONS.NONE);

  // Tri des données côté client
  const sortedItems = useMemo(() => {
    if (!sortColumn || !sortDirection) return items;

    return [...items].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];

      // Gestion des valeurs spéciales
      if (sortColumn === 'balance') {
        aValue = a.debit - a.credit;
        bValue = b.debit - b.credit;
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === SORT_DIRECTIONS.ASC ? -1 : 1;
      if (aValue > bValue) return sortDirection === SORT_DIRECTIONS.ASC ? 1 : -1;
      return 0;
    });
  }, [items, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection(SORT_DIRECTIONS.ASC);
    } else {
      // Cycle: ASC -> DESC -> NONE -> ASC
      if (sortDirection === SORT_DIRECTIONS.ASC) {
        setSortDirection(SORT_DIRECTIONS.DESC);
      } else if (sortDirection === SORT_DIRECTIONS.DESC) {
        setSortDirection(SORT_DIRECTIONS.NONE);
        setSortColumn(null);
      } else {
        setSortDirection(SORT_DIRECTIONS.ASC);
      }
    }
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return '↕️';
    if (sortDirection === SORT_DIRECTIONS.ASC) return '↑';
    if (sortDirection === SORT_DIRECTIONS.DESC) return '↓';
    return '↕️';
  };

  const SortableHeader = ({ column, children, className = "" }) => (
    <th
      className={`px-3 py-2 text-left font-semibold cursor-pointer hover:bg-neutral-100 select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <span className="text-xs opacity-60">{getSortIcon(column)}</span>
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <SortableHeader column={SORTABLE_COLUMNS.number}>
              Compte
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.label}>
              Libellé
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.debit} className="text-right">
              Débit
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.credit} className="text-right">
              Crédit
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.balance} className="text-right">
              Solde
            </SortableHeader>
            <th className="px-3 py-2 text-right font-semibold">Lettré</th>
            <th className="px-3 py-2 text-right font-semibold">Reste</th>
            <th className="px-3 py-2 text-left font-semibold">Lettrage</th>
            <SortableHeader column={SORTABLE_COLUMNS.transactionCount} className="text-right">
              Écritures
            </SortableHeader>
            <th className="px-3 py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {sortedItems.map((row) => {
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
                    {Object.keys(row.statusBreakdown).map((status) => {
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
                    href={`/ledger/${row.account.id}${
                      [
                        baseQuery.dateFrom ? `dateFrom=${encodeURIComponent(baseQuery.dateFrom)}` : null,
                        baseQuery.dateTo ? `dateTo=${encodeURIComponent(baseQuery.dateTo)}` : null,
                        baseQuery.letterStatus ? `letterStatus=${encodeURIComponent(baseQuery.letterStatus)}` : null,
                        baseQuery.direction ? `direction=${encodeURIComponent(baseQuery.direction)}` : null,
                      ]
                        .filter(Boolean)
                        .join('&')
                        .replace(/^/, (str) => (str ? `?${str}` : ''))
                    }`}
                  >
                    Détails
                  </Link>
                </td>
              </tr>
            );
          })}
          {!sortedItems.length && (
            <tr>
              <td
                colSpan={10}
                className="px-3 py-6 text-center text-neutral-500"
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
              {formatAmount(totals.totalDebit)}
            </td>
            <td className="px-3 py-2 text-right font-semibold">
              {formatAmount(totals.totalCredit)}
            </td>
            <td className="px-3 py-2 text-right font-semibold">
              {formatAmount(totals.totalDebit - totals.totalCredit)}
            </td>
            <td className="px-3 py-2 text-right font-semibold text-emerald-700">
              {formatAmount(totals.totalLettered)}
            </td>
            <td className="px-3 py-2 text-right font-semibold text-amber-700">
              {formatAmount(totals.totalOutstanding)}
            </td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}