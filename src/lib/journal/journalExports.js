import { getJournalEntries, getJournalEntryById } from "./journalService.js";
import { formatDate, formatAmount } from "./journalCalculations.js";

/**
 * Génère les données CSV pour les écritures journal
 */
export async function generateJournalCSV(companyId, filters = {}) {
  const { items } = await getJournalEntries(companyId, { ...filters, page: 1, pageSize: 10000 });

  const headers = [
    "Numéro",
    "Date",
    "Source",
    "Référence",
    "Description",
    "Statut",
    "Débit",
    "Crédit",
    "Lettré",
    "Reste",
    "Équilibré",
    "Lignes"
  ];

  const rows = items.map(entry => [
    entry.number,
    formatDate(entry.date),
    entry.sourceType,
    entry.sourceId || "",
    entry.description || "",
    entry.status,
    formatAmount(entry.debit),
    formatAmount(entry.credit),
    formatAmount(entry.lettered),
    formatAmount(entry.outstanding),
    entry.balanced ? "Oui" : "Non",
    entry.lineCount
  ]);

  return { headers, rows };
}

/**
 * Génère les données CSV détaillées pour une écriture (lignes)
 */
export async function generateJournalEntryLinesCSV(companyId, entryId) {
  const entry = await getJournalEntryById(companyId, entryId);
  if (!entry) throw new Error("Écriture non trouvée");

  const headers = [
    "Écriture",
    "Date",
    "Compte",
    "Libellé",
    "Description",
    "Débit",
    "Crédit",
    "Lettrage",
    "Lettré",
    "Reste"
  ];

  const rows = entry.lines.map(line => [
    entry.number,
    formatDate(line.date),
    line.account?.number || "",
    line.account?.label || "",
    line.description || "",
    line.direction === "DEBIT" ? formatAmount(line.amount) : "",
    line.direction === "CREDIT" ? formatAmount(line.amount) : "",
    line.letterStatus || "UNMATCHED",
    formatAmount(line.letteredAmount),
    formatAmount(Math.max(0, line.amount - line.letteredAmount))
  ]);

  return { headers, rows };
}

/**
 * Convertit les données en CSV string
 */
export function dataToCSV(headers, rows) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  return csvContent;
}

/**
 * Génère les headers HTTP pour le téléchargement CSV
 */
export function getCSVHeaders(filename) {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}