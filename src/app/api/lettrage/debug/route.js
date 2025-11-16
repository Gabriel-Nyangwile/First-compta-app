import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Récupère toutes les transactions
    const all = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        accountId: true,
        clientId: true,
        supplierId: true,
        invoiceId: true,
        letterRef: true,
        letterStatus: true,
        amount: true,
        direction: true,
        kind: true
      }
    });
    // Transactions lettrées
    const lettrage = all.filter(t => t.letterRef != null);
    // Transactions non lettrées
    const nonLettrage = all.filter(t => t.letterRef == null);
    // Parmi les lettrées, matched/unmatched
    const matched = all.filter(t => t.letterStatus === 'MATCHED');
    const unmatched = all.filter(t => t.letterStatus === 'UNMATCHED');
    return NextResponse.json({
      all,
      lettrage,
      nonLettrage,
      matched,
      unmatched,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      total: lettrage.length,
      lettrageTotal: lettrage.length,
      nonLettrageTotal: nonLettrage.length
    });
  } catch (e) {
    console.error('Erreur debug lettrage:', e);
    return NextResponse.json({ error: 'Erreur debug lettrage.', details: String(e) }, { status: 500 });
  }
}
