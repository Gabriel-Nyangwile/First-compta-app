import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateTrialBalancePdf } from "@/lib/pdf/trialBalancePdf";

export async function GET(_req) {
  try {
    const rows = await prisma.account.findMany({
      orderBy: { number: "asc" },
      include: {
        transactions: true,
      },
    });
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
