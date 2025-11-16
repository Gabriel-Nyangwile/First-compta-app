import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

// GET /api/ledger/:accountId?page=&pageSize=&dateFrom=&dateTo=&letterStatus=&direction=&q=&format=
export async function GET(request, { params }) {
  try {
    const { accountId } = params;
    if (!accountId) {
      return NextResponse.json(
        { error: "Paramètre accountId manquant" },
        { status: 400 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, number: true, label: true },
    });
    if (!account) {
      return NextResponse.json(
        { error: "Compte introuvable" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
    );
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const letterStatus = searchParams.get("letterStatus") || undefined;
    const direction = searchParams.get("direction") || undefined;
    const q = searchParams.get("q")?.trim();
    const format = searchParams.get("format");

    const filters = [{ accountId }];
    if (dateFrom || dateTo) {
      const range = {};
      if (dateFrom) range.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        range.lte = end;
      }
      filters.push({ date: range });
    }
    if (letterStatus) filters.push({ letterStatus });
    if (direction) filters.push({ direction });
    if (q) {
      const like = { contains: q, mode: "insensitive" };
      filters.push({
        OR: [
          { description: like },
          { letterRef: like },
          { journalEntry: { number: like } },
          { journalEntry: { sourceId: like } },
          { invoice: { invoiceNumber: like } },
          { incomingInvoice: { entryNumber: like } },
          { client: { name: like } },
          { supplier: { name: like } },
          { moneyMovement: { voucherRef: like } },
        ],
      });
    }
    const where = { AND: filters };

    const totalCount = await prisma.transaction.count({ where });

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        journalEntry: {
          select: {
            id: true,
            number: true,
            date: true,
            sourceType: true,
            sourceId: true,
          },
        },
        client: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
        incomingInvoice: { select: { id: true, entryNumber: true } },
        moneyMovement: { select: { id: true, voucherRef: true, kind: true } },
      },
    });

    const rows = transactions.map((tx) => {
      const amount = toNumber(tx.amount);
      const letteredAmount = toNumber(tx.letteredAmount);
      const outstanding = Math.max(0, amount - letteredAmount);
      const letterStatusValue = tx.letterStatus || "UNMATCHED";
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        direction: tx.direction,
        kind: tx.kind,
        amount,
        debit: tx.direction === "DEBIT" ? amount : 0,
        credit: tx.direction === "CREDIT" ? amount : 0,
        letterStatus: letterStatusValue,
        letterRef: tx.letterRef,
        letteredAmount,
        letteredAt: tx.letteredAt,
        outstanding,
        journalEntry: tx.journalEntry,
        client: tx.client,
        supplier: tx.supplier,
        invoice: tx.invoice,
        incomingInvoice: tx.incomingInvoice,
        moneyMovement: tx.moneyMovement,
      };
    });

    let pageDebit = 0;
    let pageCredit = 0;
    let pageLettered = 0;
    let pageOutstanding = 0;
    rows.forEach((row) => {
      pageDebit += row.debit;
      pageCredit += row.credit;
      pageLettered += row.letteredAmount;
      pageOutstanding += row.outstanding;
    });

    const aggregates = await prisma.transaction.groupBy({
      where,
      by: ["direction"],
      _sum: { amount: true, letteredAmount: true },
    });

    let totalDebit = 0;
    let totalCredit = 0;
    let totalLettered = 0;
    let totalOutstanding = 0;
    aggregates.forEach((item) => {
      const amount = toNumber(item._sum.amount);
      const letteredAmount = toNumber(item._sum.letteredAmount);
      if (item.direction === "DEBIT") totalDebit += amount;
      else totalCredit += amount;
      totalLettered += letteredAmount;
      totalOutstanding += Math.max(0, amount - letteredAmount);
    });

    if (format === "csv") {
      const header =
        "Date;Journal;Description;Statut lettrage;Ref lettrage;Debit;Credit;Lettre;Reste";
      const lines = rows
        .slice()
        .sort(
          (a, b) =>
            new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id)
        )
        .map((row) => {
          const date = row.date
            ? new Date(row.date).toISOString().slice(0, 10)
            : "";
          const journal = row.journalEntry?.number || "";
          const desc = (row.description || "").replace(/"/g, '""');
          return [
            date,
            journal,
            `"${desc}"`,
            row.letterStatus || "",
            row.letterRef || "",
            row.debit ? row.debit.toFixed(2) : "",
            row.credit ? row.credit.toFixed(2) : "",
            row.letteredAmount ? row.letteredAmount.toFixed(2) : "",
            row.outstanding ? row.outstanding.toFixed(2) : "",
          ].join(";");
        });
      const csv = [header, ...lines].join("\n");
      return new Response(csv, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    }

    return NextResponse.json({
      account: {
        id: account.id,
        number: account.number,
        label: account.label,
      },
      items: rows.map((row) => ({
        id: row.id,
        date: row.date,
        description: row.description,
        direction: row.direction,
        kind: row.kind,
        amount: row.amount,
        debit: row.debit,
        credit: row.credit,
        letterStatus: row.letterStatus,
        letterRef: row.letterRef,
        letteredAmount: row.letteredAmount,
        letteredAt: row.letteredAt,
        outstanding: row.outstanding,
        journalEntry: row.journalEntry,
        clientId: row.client?.id,
        supplierId: row.supplier?.id,
        invoiceId: row.invoice?.id,
        incomingInvoiceId: row.incomingInvoice?.id,
        moneyMovementId: row.moneyMovement?.id,
      })),
      totals: {
        totalDebit,
        totalCredit,
        totalLettered,
        totalOutstanding,
      },
      pageTotals: {
        pageDebit,
        pageCredit,
        pageLettered,
        pageOutstanding,
      },
      pagination: {
        page,
        pageSize,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      },
      filters: {
        dateStart: dateFrom || null,
        dateEnd: dateTo || null,
        letterStatus: letterStatus || null,
        direction: direction || null,
        search: q || null,
      },
    });
  } catch (e) {
    console.error("/api/ledger/:accountId error", e);
    return NextResponse.json(
      { error: "Erreur détail grand livre." },
      { status: 500 }
    );
  }
}
