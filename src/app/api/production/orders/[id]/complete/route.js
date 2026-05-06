import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { completeOrder } from "@/lib/production";

export async function POST(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageProduction", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json();
    const result = await completeOrder({ id, companyId, body });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erreur déclaration production." }, { status: 400 });
  }
}
