'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { formatDate, formatAmount } from '@/lib/clientUtils';

const SORT_DIRECTIONS = {
  ASC: 'asc',
  DESC: 'desc',
  NONE: null,
};

const SORTABLE_COLUMNS = {
  number: 'number',
  date: 'date',
  sourceType: 'sourceType',
  status: 'status',
  debit: 'debit',
  credit: 'credit',
  lettered: 'lettered',
  outstanding: 'outstanding',
  lineCount: 'lineCount',
};

export default function JournalTable({ items, baseQuery }) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState(SORT_DIRECTIONS.NONE);

  // Tri des données côté client
  const sortedItems = useMemo(() => {
    if (!sortColumn || !sortDirection) return items;

    return [...items].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];

      if (sortColumn === 'date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
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
              Écriture
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.date}>
              Date
            </SortableHeader>
            <th className="px-3 py-2 text-left font-semibold">Source</th>
            <SortableHeader column={SORTABLE_COLUMNS.status}>
              Statut
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.debit}>
              Débit
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.credit}>
              Crédit
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.lettered}>
              Lettré
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.outstanding}>
              Reste
            </SortableHeader>
            <SortableHeader column={SORTABLE_COLUMNS.lineCount}>
              Lignes
            </SortableHeader>
            <th className="px-3 py-2 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {sortedItems.map((entry) => {
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
          {!sortedItems.length && (
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
  );
}