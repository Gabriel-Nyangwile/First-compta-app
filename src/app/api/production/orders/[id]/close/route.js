import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { closeOrder } from "@/lib/production";

export async function POST(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageProduction", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await context.params;
    const order = await closeOrder({ id, companyId });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Erreur clôture ordre." }, { status: 400 });
  }
}
