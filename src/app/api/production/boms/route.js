import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestRole } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { createBom, listBoms } from "@/lib/production";

export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const boms = await listBoms({
      companyId,
      status: searchParams.get("status"),
      q: searchParams.get("q"),
    });
    return NextResponse.json({ boms });
  } catch (error) {
    console.error("GET /api/production/boms", error);
    return NextResponse.json({ error: error.message || "Erreur nomenclatures." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageProduction", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const bom = await createBom({ companyId, body });
    return NextResponse.json({ bom }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Nomenclature déjà existante pour ce produit/version ou code." }, { status: 409 });
    }
    console.error("POST /api/production/boms", error);
    return NextResponse.json({ error: error.message || "Erreur création nomenclature." }, { status: 400 });
  }
}
