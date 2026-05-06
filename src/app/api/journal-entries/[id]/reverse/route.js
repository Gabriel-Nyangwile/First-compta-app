import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/tenant";
import { checkPerm } from "@/lib/authz";
import { getRequestActor } from "@/lib/requestAuth";
import { reverseManualJournalEntry } from "@/lib/journalReversal";

export async function POST(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const actor = await getRequestActor(request, { companyId });
    if (!actor?.role || !checkPerm("reopenPeriod", actor.role)) {
      return NextResponse.json(
        { error: "Annulation réservée au responsable finance ou superadmin" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reversalDate = body?.date ? new Date(body.date) : new Date();
    const result = await reverseManualJournalEntry({
      companyId,
      journalEntryId: id,
      reversalDate,
      reason: body?.reason || null,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const message = error.message || "Erreur annulation OD";
    const status =
      message.includes("introuvable") ? 404 :
      message.includes("réservée") ? 403 :
      400;
    return NextResponse.json({ error: message }, { status });
  }
}
