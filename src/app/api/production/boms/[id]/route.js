import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { getBom, updateBom } from "@/lib/production";

async function paramsOf(context) {
  const params = await context?.params;
  return params || {};
}

export async function GET(request, context) {
  try {
    const companyId = requireCompanyId(request);
    const { id } = await paramsOf(context);
    const bom = await getBom({ id, companyId });
    if (!bom) return NextResponse.json({ error: "Nomenclature introuvable." }, { status: 404 });
    return NextResponse.json({ bom });
  } catch (error) {
    console.error("GET /api/production/boms/[id]", error);
    return NextResponse.json({ error: error.message || "Erreur nomenclature." }, { status: 500 });
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
    const bom = await updateBom({ id, companyId, body });
    return NextResponse.json({ bom });
  } catch (error) {
    console.error("PUT /api/production/boms/[id]", error);
    return NextResponse.json({ error: error.message || "Erreur mise à jour nomenclature." }, { status: 400 });
  }
}
