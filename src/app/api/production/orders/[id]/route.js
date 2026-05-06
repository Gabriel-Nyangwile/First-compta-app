import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { getOrder, updateOrder } from "@/lib/production";

async function paramsOf(context) {
  const params = await context?.params;
  return params || {};
}

export async function GET(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const { id } = await paramsOf(context);
    const order = await getOrder({ id, companyId });
    if (!order) return NextResponse.json({ error: "Ordre introuvable." }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET /api/production/orders/[id]", error);
    return NextResponse.json({ error: error.message || "Erreur ordre." }, { status: 500 });
  }
}

export async function PUT(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageProduction", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await paramsOf(context);
    const body = await request.json();
    const order = await updateOrder({ id, companyId, body });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("PUT /api/production/orders/[id]", error);
    return NextResponse.json({ error: error.message || "Erreur mise à jour ordre." }, { status: 400 });
  }
}
