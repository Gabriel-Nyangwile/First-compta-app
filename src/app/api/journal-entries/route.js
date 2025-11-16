import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

// GET /api/journal-entries?page=&pageSize=&sourceType=&status=&dateFrom=&dateTo=&letterStatus=&accountId=&q=
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const sourceType = searchParams.get("sourceType") || undefined;
    const status = searchParams.get("status") || undefined;
    const numberQuery = searchParams.get("number")?.trim();
    const sourceId = searchParams.get("sourceId")?.trim();
    const letterStatus = searchParams.get("letterStatus") || undefined;
    const accountId = searchParams.get("accountId") || undefined;
    const q = searchParams.get("q")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const filters = [];
    if (sourceType) filters.push({ sourceType });
    if (status) filters.push({ status });
    if (numberQuery)
      filters.push({ number: { contains: numberQuery, mode: "insensitive" } });
    if (sourceId)
      filters.push({ sourceId: { contains: sourceId, mode: "insensitive" } });

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

    const lineFilters = [];
    if (letterStatus) lineFilters.push({ letterStatus });
    if (accountId) lineFilters.push({ accountId });
    if (lineFilters.length) {
      filters.push({ lines: { some: { AND: lineFilters } } });
    }

    if (q) {
      const like = { contains: q, mode: "insensitive" };
      filters.push({
        OR: [
          { number: like },
          { description: like },
          { sourceId: like },
          {
            lines: {
              some: {
                OR: [
                  { description: like },
                  { letterRef: like },
                  { account: { number: { contains: q } } },
                  { account: { label: like } },
                ],
              },
            },
          },
        ],
      });
    }

    const where = filters.length ? { AND: filters } : undefined;
    const totalCount = await prisma.journalEntry.count({ where });
    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { number: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        lines: {
          orderBy: [{ date: "asc" }, { id: "asc" }],
          include: {
            account: { select: { id: true, number: true, label: true } },
          },
        },
      },
    });

    const items = entries.map((entry) => {
      let totalDebit = 0;
      let totalCredit = 0;
      let totalLettered = 0;
      let totalOutstanding = 0;
      const lines = entry.lines.map((line) => {
        const amount = toNumber(line.amount);
        const letteredAmount = toNumber(line.letteredAmount);
        const outstanding = Math.max(0, amount - letteredAmount);
        const letterStatusValue = line.letterStatus || "UNMATCHED";
        if (line.direction === "DEBIT") totalDebit += amount;
        else totalCredit += amount;
        totalLettered += letteredAmount;
        totalOutstanding += outstanding;
        return {
          id: line.id,
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
          invoiceId: line.invoiceId,
          supplierId: line.supplierId,
          clientId: line.clientId,
        };
      });
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;
      return {
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
      };
    });

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
      },
      filters: {
        dateStart: dateFrom || null,
        dateEnd: dateTo || null,
        sourceType: sourceType || null,
        search: q || null,
      },
    });
  } catch (e) {
    console.error("GET /api/journal-entries error", e);
    return NextResponse.json(
      { error: "Erreur listing journal." },
      { status: 500 }
    );
  }
}
