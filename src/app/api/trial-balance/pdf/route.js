import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateTrialBalancePdf } from "@/lib/pdf/trialBalancePdf";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
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

    const transactionWhere = filters.length
      ? { AND: [{ companyId }, ...filters] }
      : { companyId };

    const transactions = await prisma.transaction.findMany({
      where: transactionWhere,
      include: { account: { select: { id: true, number: true, label: true } } },
    });

    const accountMap = new Map();
    for (const tx of transactions) {
      const key = tx.account.id;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          account: tx.account,
          transactions: [],
        });
      }
      accountMap.get(key).transactions.push(tx);
    }

    let rows = [...accountMap.values()].sort((a, b) =>
      a.account.number.localeCompare(b.account.number)
    );
    if (!includeZero) {
      rows = rows.filter((row) => {
        let debit = 0;
        let credit = 0;
        for (const tx of row.transactions) {
          const amount = Number(tx.amount?.toNumber?.() ?? tx.amount ?? 0);
          if (tx.direction === "DEBIT") debit += amount;
          else credit += amount;
        }
        return debit !== 0 || credit !== 0;
      });
    }

    // Génération PDF via utilitaire serveur (à créer si absent)
    const pdfBuffer = await generateTrialBalancePdf({ rows });
    return new Response(pdfBuffer, {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  } catch (e) {
    return new Response("Erreur export PDF", { status: 500 });
  }
}
