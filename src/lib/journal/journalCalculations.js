import { TransactionDirection } from '@prisma/client';

/**
 * Convertit une valeur Decimal ou number en number
 */
export function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
}

/**
 * Formate un montant en euros
 */
export function formatAmount(value) {
  const num = toNumber(value);
  return num.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formate une date en français
 */
export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

/**
 * Formate une date et heure en français
 */
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Calcule les totaux d'une écriture journal
 */
export function calculateJournalEntryTotals(lines) {
  let debit = 0;
  let credit = 0;
  let lettered = 0;
  let outstanding = 0;

  lines.forEach((line) => {
    const amount = toNumber(line.amount);
    const letteredAmount = toNumber(line.letteredAmount);
    const outstandingLine = Math.max(0, amount - letteredAmount);

    if (line.direction === "DEBIT") debit += amount;
    else credit += amount;

    lettered += letteredAmount;
    outstanding += outstandingLine;
  });

  return {
    debit,
    credit,
    balanced: Math.abs(debit - credit) < 0.001,
    lettered,
    outstanding,
    lineCount: lines.length,
  };
}

/**
 * Calcule les statistiques de lettrage pour une liste de transactions
 */
export function calculateLettrageStats(transactions) {
  const stats = {
    UNMATCHED: 0,
    PARTIAL: 0,
    MATCHED: 0,
  };

  transactions.forEach((tx) => {
    const status = tx.letterStatus || "UNMATCHED";
    stats[status] = (stats[status] || 0) + 1;
  });

  return stats;
}

/**
 * Calcule le pourcentage pour les statistiques
 */
export function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

/**
 * Construit une query string pour les filtres
 */
export function buildQueryString(currentParams, overrides = {}) {
  const query = new URLSearchParams();

  // Ajouter les paramètres actuels
  for (const [key, value] of Object.entries(currentParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== "") {
      query.set(key, String(value));
    }
  }

  // Appliquer les overrides
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") {
      query.delete(key);
      continue;
    }
    query.set(key, String(value));
  }

  const queryStr = query.toString();
  return queryStr ? `?${queryStr}` : "";
}