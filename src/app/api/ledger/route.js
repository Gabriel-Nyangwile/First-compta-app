import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

// GET /api/ledger?dateFrom=&dateTo=&letterStatus=&accountId=&includeZero=&q=
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const q = searchParams.get("q")?.trim()?.toLowerCase();
    const letterStatus = searchParams.get("letterStatus") || undefined;
    const accountId = searchParams.get("accountId") || undefined;
    const includeZero = searchParams.get("includeZero") !== "false";

    const filters = [];
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
    if (accountId) filters.push({ accountId });
    const where = filters.length ? { AND: filters } : undefined;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { account: { select: { id: true, number: true, label: true } } },
    });

    const map = new Map();
    for (const tx of transactions) {
      const { account } = tx;
      if (
        q &&
        !account.number.includes(q) &&
        !(account.label || "").toLowerCase().includes(q)
      ) {
        continue;
      }
      const key = account.id;
      if (!map.has(key)) {
        map.set(key, {
          account,
          debit: 0,
          credit: 0,
          letteredAmount: 0,
          outstandingAmount: 0,
          transactionCount: 0,
          statusBreakdown: { UNMATCHED: 0, PARTIAL: 0, MATCHED: 0 },
        });
      }
      const bucket = map.get(key);
      const amount = toNumber(tx.amount);
      const letteredAmount = toNumber(tx.letteredAmount);
      const outstanding = Math.max(0, amount - letteredAmount);
      if (tx.direction === "DEBIT") bucket.debit += amount;
      else bucket.credit += amount;
      bucket.letteredAmount += letteredAmount;
      bucket.outstandingAmount += outstanding;
      bucket.transactionCount += 1;
      const statusKey = tx.letterStatus || "UNMATCHED";
      if (bucket.statusBreakdown[statusKey] == null) {
        bucket.statusBreakdown[statusKey] = 0;
      }
      bucket.statusBreakdown[statusKey] += 1;
    }

    let rows = [...map.values()].sort((a, b) =>
      a.account.number.localeCompare(b.account.number)
    );
    if (!includeZero) {
      rows = rows.filter((row) => row.debit !== 0 || row.credit !== 0);
    }

    let totalDebit = 0;
    let totalCredit = 0;
    let totalLettered = 0;
    let totalOutstanding = 0;
    rows.forEach((row) => {
      totalDebit += row.debit;
      totalCredit += row.credit;
      totalLettered += row.letteredAmount;
      totalOutstanding += row.outstandingAmount;
    });

    return NextResponse.json({
      items: rows.map((row) => ({
        accountNumber: row.account.number,
        accountLabel: row.account.label,
        debit: row.debit,
        credit: row.credit,
        letteredAmount: row.letteredAmount,
        outstandingAmount: row.outstandingAmount,
        transactionCount: row.transactionCount,
        statusBreakdown: row.statusBreakdown,
      })),
      totals: {
        totalDebit,
        totalCredit,
        totalLettered,
        totalOutstanding,
      },
      filters: {
        dateStart: dateFrom || null,
        dateEnd: dateTo || null,
        letterStatus: letterStatus || null,
        accountId: accountId || null,
        search: q || null,
      },
    });
  } catch (e) {
    console.error("/api/ledger error", e);
    return NextResponse.json({ error: "Erreur ledger" }, { status: 500 });
  }
}
