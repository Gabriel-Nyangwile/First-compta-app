import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/tenant";
import { getOpeningStatus } from "@/lib/opening/importers";
import { listOpeningTemplates } from "@/lib/opening/templates";

export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const status = await getOpeningStatus(companyId);
    return NextResponse.json({
      ok: true,
      ...status,
      templates: listOpeningTemplates(),
    });
  } catch (error) {
    console.error("GET /api/opening/status error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur statut ouverture" },
      { status: 500 }
    );
  }
}
