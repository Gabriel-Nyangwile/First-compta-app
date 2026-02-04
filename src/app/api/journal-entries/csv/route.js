import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const entries = await prisma.journalEntry.findMany({
      where: { companyId },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      include: {
        lines: {
          orderBy: [{ date: "asc" }, { id: "asc" }],
          include: {
            account: { select: { number: true, label: true } },
            client: { select: { name: true } },
            supplier: { select: { name: true } },
            invoice: { select: { invoiceNumber: true } },
            incomingInvoice: { select: { entryNumber: true } },
            moneyMovement: { select: { voucherRef: true } },
          },
        },
      },
    });
    const header = [
      "Date",
      "Journal",
      "Compte",
      "Libellé",
      "Débit",
      "Crédit",
      "Lettrage",
      "Ref lettrage",
      "Lettré",
      "Reste",
      "Client",
      "Fournisseur",
      "Facture",
      "Entrée fournisseur",
      "Mouvement",
    ];
    const lines = entries.flatMap((entry) => entry.lines.map((row) => [
      entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "",
      entry.number || "",
      row.account?.number || "",
      (row.description || "").replace(/"/g, '""'),
      row.direction === "DEBIT" ? toNumber(row.amount).toFixed(2) : "",
      row.direction === "CREDIT" ? toNumber(row.amount).toFixed(2) : "",
      row.letterStatus || "",
      row.letterRef || "",
      row.letteredAmount ? toNumber(row.letteredAmount).toFixed(2) : "",
      row.amount && row.letteredAmount ? (toNumber(row.amount) - toNumber(row.letteredAmount)).toFixed(2) : "",
      row.client?.name || "",
      row.supplier?.name || "",
      row.invoice?.invoiceNumber || "",
      row.incomingInvoice?.entryNumber || "",
      row.moneyMovement?.voucherRef || "",
    ].join(";") ));
    const csv = [header.join(";"), ...lines].join("\n");
    return new Response(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch (e) {
    return new Response("Erreur export CSV", { status: 500 });
  }
}
