import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const rows = await prisma.account.findMany({
      where: { companyId },
      orderBy: { number: "asc" },
      include: {
        transactions: true,
      },
    });
    const header = [
      "Compte",
      "Libellé",
      "Débit",
      "Crédit",
      "Solde",
      "Lettré",
      "Reste",
    ];
    const lines = rows.map((row) => {
      let debit = 0, credit = 0, lettered = 0, outstanding = 0;
      for (const tx of row.transactions) {
        if (tx.direction === "DEBIT") debit += Number(tx.amount);
        else credit += Number(tx.amount);
        lettered += Number(tx.letteredAmount);
        outstanding += Math.max(0, Number(tx.amount) - Number(tx.letteredAmount));
      }
      const balance = debit - credit;
      return [
        row.number,
        (row.label || "").replace(/"/g, '""'),
        debit.toFixed(2),
        credit.toFixed(2),
        balance.toFixed(2),
        lettered.toFixed(2),
        outstanding.toFixed(2),
      ].join(";");
    });
    const csv = [header.join(";"), ...lines].join("\n");
    return new Response(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  } catch (e) {
    return new Response("Erreur export CSV", { status: 500 });
  }
}
