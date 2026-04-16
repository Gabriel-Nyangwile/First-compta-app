import { getLedgerData, getAccountTransactions } from "./ledgerService.js";
import { formatDate, formatAmount } from "./ledgerCalculations.js";

/**
 * Génère les données CSV pour le grand livre
 */
export async function generateLedgerCSV(companyId, filters = {}) {
  const { accounts, totals } = await getLedgerData(companyId, filters);

  const headers = [
    "Compte",
    "Libellé",
    "Débit",
    "Crédit",
    "Solde",
    "Lettré",
    "Reste à lettrer",
    "Écritures",
    "Non lettré",
    "Partiellement lettré",
    "Complètement lettré"
  ];

  const rows = accounts.map(row => {
    const balance = row.debit - row.credit;
    return [
      row.account.number,
      row.account.label,
      formatAmount(row.debit),
      formatAmount(row.credit),
      formatAmount(balance),
      formatAmount(row.letteredAmount),
      formatAmount(row.outstandingAmount),
      row.transactionCount,
      row.statusBreakdown.UNMATCHED || 0,
      row.statusBreakdown.PARTIAL || 0,
      row.statusBreakdown.MATCHED || 0
    ];
  });

  // Ajouter une ligne de totaux
  rows.push([
    "TOTAUX",
    "",
    formatAmount(totals.totalDebit),
    formatAmount(totals.totalCredit),
    formatAmount(totals.totalDebit - totals.totalCredit),
    formatAmount(totals.totalLettered),
    formatAmount(totals.totalOutstanding),
    "",
    "",
    "",
    ""
  ]);

  return { headers, rows };
}

/**
 * Génère les données CSV pour les transactions d'un compte
 */
export async function generateAccountTransactionsCSV(companyId, accountId, filters = {}) {
  const { account, transactions } = await getAccountTransactions(companyId, accountId, { ...filters, page: 1, pageSize: 10000 });

  const headers = [
    "Date",
    "Journal",
    "Source",
    "Description",
    "Client/Fournisseur",
    "Pièce",
    "Débit",
    "Crédit",
    "Lettrage",
    "Lettré",
    "Reste"
  ];

  const rows = transactions.map(tx => {
    // Déterminer les relations
    let relation = "";
    if (tx.client) relation = `Client: ${tx.client.name}`;
    else if (tx.supplier) relation = `Fournisseur: ${tx.supplier.name}`;

    let piece = "";
    if (tx.invoice) piece = `Facture ${tx.invoice.invoiceNumber}`;
    else if (tx.incomingInvoice) piece = `Facture fournisseur ${tx.incomingInvoice.entryNumber}`;
    else if (tx.moneyMovement) piece = `Mouvement ${tx.moneyMovement.voucherRef}`;

    return [
      formatDate(tx.date),
      tx.journalEntry?.number || "",
      `${tx.journalEntry?.sourceType || ""} ${tx.journalEntry?.sourceId || ""}`.trim(),
      tx.description || "",
      relation,
      piece,
      tx.debit ? formatAmount(tx.debit) : "",
      tx.credit ? formatAmount(tx.credit) : "",
      tx.letterStatus,
      formatAmount(tx.letteredAmount),
      formatAmount(tx.outstanding)
    ];
  });

  return { headers, rows, account };
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