import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const revalidate = 60; // cache hint
export const dynamic = "force-dynamic"; // uses request.url (searchParams)

const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return value.toNumber?.() ?? Number(value) ?? 0;
};

// GET /api/trial-balance?dateFrom=&dateTo=&format=csv&includeZero=
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const format = searchParams.get("format");
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
    const where = filters.length ? { AND: filters } : undefined;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { account: { select: { id: true, number: true, label: true } } },
    });

    const map = new Map();
    for (const tx of transactions) {
      const key = tx.account.id;
      if (!map.has(key)) {
        map.set(key, {
          account: tx.account,
          debit: 0,
          credit: 0,
        });
      }
      const bucket = map.get(key);
      const amount = toNumber(tx.amount);
      if (tx.direction === "DEBIT") bucket.debit += amount;
      else bucket.credit += amount;
    }

    let rows = [...map.values()].sort((a, b) =>
      a.account.number.localeCompare(b.account.number)
    );
    if (!includeZero) {
      rows = rows.filter((row) => row.debit !== 0 || row.credit !== 0);
    }

    let totalDebit = 0;
    let totalCredit = 0;
    rows.forEach((row) => {
      totalDebit += row.debit;
      totalCredit += row.credit;
    });

    if (format === "csv") {
      const header = "Compte;Libellé;Débit;Crédit;Solde(D-C)";
      const lines = rows.map(
        (row) =>
          `${row.account.number};"${(row.account.label || "").replace(
            /"/g,
            '""'
          )}";${row.debit.toFixed(2)};${row.credit.toFixed(2)};${(
            row.debit - row.credit
          ).toFixed(2)}`
      );
      lines.push(
        `TOTAL;;${totalDebit.toFixed(2)};${totalCredit.toFixed(2)};${(
          totalDebit - totalCredit
        ).toFixed(2)}`
      );
      const csv = [header, ...lines].join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    return NextResponse.json(
      { rows, totalDebit, totalCredit },
      { status: 200, headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (e) {
    console.error("trial-balance error", e);
    return NextResponse.json(
      { error: "Erreur trial balance" },
      { status: 500 }
    );
  }
}
