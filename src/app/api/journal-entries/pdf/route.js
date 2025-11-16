import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateJournalPdf } from "@/lib/pdf/journalPdf";

export async function GET(_req) {
  try {
    const entries = await prisma.journalEntry.findMany({
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
    // Génération PDF via utilitaire serveur (à créer si absent)
    const pdfBuffer = await generateJournalPdf({ entries });
    return new Response(pdfBuffer, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (e) {
    return new Response("Erreur export PDF", { status: 500 });
  }
}
