import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const all = await prisma.transaction.findMany({
      where: { companyId },
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
    const lettrage = all.filter(t => t.letterRef != null);
    const nonLettrage = all.filter(t => t.letterRef == null);
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
