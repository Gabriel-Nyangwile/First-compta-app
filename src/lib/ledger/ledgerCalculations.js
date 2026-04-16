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
  if (!num) return "0,00";
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
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const params = new URLSearchParams();

  // Ajouter les paramètres actuels
  for (const [key, value] of Object.entries(currentParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== "") {
      params.set(key, String(value));
    }
  }

  // Appliquer les overrides
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") {
      params.delete(key);
      continue;
    }
    params.set(key, String(value));
  }

  const queryStr = params.toString();
  return queryStr ? `?${queryStr}` : "";
}

/**
 * Calcule les agrégats pour un compte
 */
export function calculateAccountAggregates(directionGroups, totalsByAccount, statusGroups, accounts) {
  const accountMap = new Map();

  // Initialiser tous les comptes
  accounts.forEach((account) => {
    accountMap.set(account.id, {
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
  });

  // Mettre à jour avec les données des transactions
  totalsByAccount.forEach((group) => {
    const accountId = group.accountId;
    const row = accountMap.get(accountId);
    if (!row) return;
    const totalAmount = toNumber(group._sum.amount);
    const letteredAmount = toNumber(group._sum.letteredAmount);

    row.letteredAmount = letteredAmount;
    row.outstandingAmount = Math.max(0, totalAmount - letteredAmount);
    row.transactionCount = group._count._all;
  });

  // Ajouter les montants par direction
  directionGroups.forEach((group) => {
    const row = accountMap.get(group.accountId);
    if (!row) return;
    const amount = toNumber(group._sum.amount);
    if (group.direction === "DEBIT") row.debit = amount;
    else if (group.direction === "CREDIT") row.credit = amount;
  });

  // Ajouter les statistiques de lettrage
  statusGroups.forEach((group) => {
    const row = accountMap.get(group.accountId);
    if (!row) return;
    const statusKey = group.letterStatus || "UNMATCHED";
    row.statusBreakdown[statusKey] = group._count._all;
  });

  return accountMap;
}

/**
 * Filtre les comptes selon les critères
 */
export function filterAccounts(accounts, accountMap, includeZero) {
  return accounts
    .map((account) => ({
      account,
      ...accountMap.get(account.id),
    }))
    .filter((row) => row.transactionCount > 0 || includeZero)
    .filter((row) => includeZero || row.debit !== 0 || row.credit !== 0);
}

/**
 * Calcule les totaux globaux
 */
export function calculateGlobalTotals(rows) {
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

  return {
    totalDebit,
    totalCredit,
    totalLettered,
    totalOutstanding,
  };
}