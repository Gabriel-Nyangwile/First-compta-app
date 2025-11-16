import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateLedgerPdf } from "@/lib/pdf/ledgerPdf";

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
    // Génération PDF via utilitaire serveur (à créer si absent)
    const pdfBuffer = await generateLedgerPdf({ account, transactions });
    return new Response(pdfBuffer, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (e) {
    return new Response("Erreur export PDF", { status: 500 });
  }
}
