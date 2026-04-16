// Client-side utilities for formatting
// These functions are safe to use in client components

export function formatDate(date) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatAmount(value) {
  if (value == null) return "0,00";
  try {
    const num = typeof value === "number" ? value : Number(value) || 0;
    return num.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0,00";
  }
}

export function formatPercent(value, total) {
  if (!total) return "0%";
  try {
    return `${Math.round((value / total) * 100)}%`;
  } catch {
    return "0%";
  }
}