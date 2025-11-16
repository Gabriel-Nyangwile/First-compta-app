import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

export async function GET(_req, { params }) {
  try {
    const { accountId } = params;
    if (!accountId) {
      return new Response("Paramètre accountId manquant", { status: 400 });
    }
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, number: true, label: true },
    });
    if (!account) {
      return new Response("Compte introuvable", { status: 404 });
    }
    const transactions = await prisma.transaction.findMany({
      where: { accountId },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        journalEntry: { select: { number: true } },
        client: { select: { name: true } },
        supplier: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
        incomingInvoice: { select: { entryNumber: true } },
        moneyMovement: { select: { voucherRef: true } },
      },
    });
    const header = [
      "Date",
      "Journal",
      "Description",
      "Statut lettrage",
      "Ref lettrage",
      "Débit",
      "Crédit",
      "Lettré",
      "Reste",
      "Client",
      "Fournisseur",
      "Facture",
      "Entrée fournisseur",
      "Mouvement",
    ];
    const lines = transactions.map((row) => [
      row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
      row.journalEntry?.number || "",
      (row.description || "").replace(/"/g, '""'),
      row.letterStatus || "",
      row.letterRef || "",
      row.direction === "DEBIT" ? toNumber(row.amount).toFixed(2) : "",
      row.direction === "CREDIT" ? toNumber(row.amount).toFixed(2) : "",
      row.letteredAmount ? toNumber(row.letteredAmount).toFixed(2) : "",
      row.amount && row.letteredAmount ? (toNumber(row.amount) - toNumber(row.letteredAmount)).toFixed(2) : "",
      row.client?.name || "",
      row.supplier?.name || "",
      row.invoice?.invoiceNumber || "",
      row.incomingInvoice?.entryNumber || "",
      row.moneyMovement?.voucherRef || "",
    ].join(";") );
    const csv = [header.join(";"), ...lines].join("\n");
    return new Response(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch (e) {
    return new Response("Erreur export CSV", { status: 500 });
  }
}
