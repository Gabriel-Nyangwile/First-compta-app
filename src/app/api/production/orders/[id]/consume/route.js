import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { consumeOrder } from "@/lib/production";

export async function POST(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageProduction", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await consumeOrder({ id, companyId, body });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erreur consommation composants." }, { status: 400 });
  }
}
