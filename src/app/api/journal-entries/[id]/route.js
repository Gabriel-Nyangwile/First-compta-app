import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

export async function GET(req, { params }) {
  try {
    const companyId = requireCompanyId(req);
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || undefined;
    const entry = await prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          orderBy: [{ date: "asc" }, { id: "asc" }],
          include: {
            account: { select: { id: true, number: true, label: true } },
            client: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            invoice: { select: { id: true, invoiceNumber: true } },
            incomingInvoice: { select: { id: true, entryNumber: true } },
            moneyMovement: {
              select: { id: true, voucherRef: true, kind: true },
            },
          },
        },
      },
    });
    if (!entry) {
      return NextResponse.json(
        { error: "JournalEntry introuvable" },
        { status: 404 }
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;
    let totalLettered = 0;
    let totalOutstanding = 0;

    const lines = entry.lines.map((line, index) => {
      const amount = toNumber(line.amount);
      const letteredAmount = toNumber(line.letteredAmount);
      const outstanding = Math.max(0, amount - letteredAmount);
      const letterStatusValue = line.letterStatus || "UNMATCHED";
      if (line.direction === "DEBIT") totalDebit += amount;
      else totalCredit += amount;
      totalLettered += letteredAmount;
      totalOutstanding += outstanding;
      return {
        index: index + 1,
        id: line.id,
        accountId: line.account?.id,
        accountNumber: line.account?.number,
        accountLabel: line.account?.label,
        debit: line.direction === "DEBIT" ? amount : 0,
        credit: line.direction === "CREDIT" ? amount : 0,
        amount,
        direction: line.direction,
        kind: line.kind,
        description: line.description,
        letterStatus: letterStatusValue,
        letterRef: line.letterRef,
        letteredAmount,
        letteredAt: line.letteredAt,
        outstanding,
        client: line.client
          ? { id: line.client.id, name: line.client.name }
          : null,
        supplier: line.supplier
          ? { id: line.supplier.id, name: line.supplier.name }
          : null,
        invoice: line.invoice
          ? { id: line.invoice.id, reference: line.invoice.invoiceNumber }
          : null,
        incomingInvoice: line.incomingInvoice
          ? {
              id: line.incomingInvoice.id,
              reference: line.incomingInvoice.entryNumber,
            }
          : null,
        moneyMovement: line.moneyMovement
          ? {
              id: line.moneyMovement.id,
              reference: line.moneyMovement.voucherRef,
              kind: line.moneyMovement.kind,
            }
          : null,
        clientId: line.client?.id,
        supplierId: line.supplier?.id,
        invoiceId: line.invoice?.id,
        incomingInvoiceId: line.incomingInvoice?.id,
        moneyMovementId: line.moneyMovement?.id,
      };
    });

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

    if (format === "csv") {
      const header = [
        "Index",
        "Compte",
        "Libellé compte",
        "Description",
        "Type",
        "Débit",
        "Crédit",
        "Statut lettrage",
        "Réf. lettrage",
        "Lettré",
        "Reste",
        "Client",
        "Fournisseur",
        "Facture client",
        "Facture fournisseur",
        "Mouvement trésorerie",
      ];
      const csvLines = lines.map((line) =>
        [
          String(line.index),
          line.accountNumber || "",
          `"${(line.accountLabel || "").replace(/"/g, '""')}"`,
          `"${(line.description || "").replace(/"/g, '""')}"`,
          line.kind || "",
          line.debit ? line.debit.toFixed(2) : "",
          line.credit ? line.credit.toFixed(2) : "",
          line.letterStatus || "",
          line.letterRef || "",
          line.letteredAmount ? line.letteredAmount.toFixed(2) : "",
          line.outstanding ? line.outstanding.toFixed(2) : "",
          `"${(line.client?.name || "").replace(/"/g, '""')}"`,
          `"${(line.supplier?.name || "").replace(/"/g, '""')}"`,
          line.invoice?.reference || "",
          line.incomingInvoice?.reference || "",
          line.moneyMovement?.reference || "",
        ].join(";")
      );
      const csv = [header.join(";"), ...csvLines].join("\n");
      return new Response(csv, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    }

    return NextResponse.json({
      id: entry.id,
      reference: entry.number,
      date: entry.date,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      description: entry.description,
      status: entry.status,
      postedAt: entry.postedAt,
      totalDebit,
      totalCredit,
      isBalanced,
      lineCount: lines.length,
      totalLettered,
      totalOutstanding,
      lines,
    });
  } catch (e) {
    console.error("GET /api/journal-entries/:id error", e);
    return NextResponse.json(
      { error: "Erreur détail journal." },
      { status: 500 }
    );
  }
}
