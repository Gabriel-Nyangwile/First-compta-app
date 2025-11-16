import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Récupère toutes les transactions
    const all = await prisma.transaction.findMany({ select: { letterRef: true, letterStatus: true } });
    // Lettrées = letterRef non nul
    //const lettrage = all.filter(t => t.letterRef != null);
    const total = all.length;
    const matched = all.filter(t => t.letterStatus === 'MATCHED').length;
    const unmatched = all.filter(t => t.letterStatus === 'UNMATCHED').length;
    const rate = total > 0 ? Math.round(100 * (matched / total)) : 0;
    return NextResponse.json({ total, matched, unmatched, rate });
  } catch (e) {
    console.error("GET /api/lettrage/summary error", e);
    return NextResponse.json({ error: "Erreur récupération lettrage." }, { status: 500 });
  }
}
