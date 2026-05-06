import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { setBomStatus } from "@/lib/production";

export async function POST(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageProduction", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    const bom = await setBomStatus({ id, companyId, status: "ACTIVE" });
    return NextResponse.json({ bom });
  } catch (error) {
    console.error("POST /api/production/boms/[id]/activate", error);
    return NextResponse.json({ error: error.message || "Erreur activation nomenclature." }, { status: 400 });
  }
}
