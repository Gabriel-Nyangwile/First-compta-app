import { NextResponse } from "next/server";
import { getSupplierLettering } from "@/lib/serverActions/ledgers";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  const supplierId = id;
  if (!supplierId) {
    return NextResponse.json({ error: "supplierId requis" }, { status: 400 });
  }

  try {
    const data = await getSupplierLettering({ supplierId, companyId });
    return NextResponse.json(data);
  } catch (error) {
    console.error("getSupplierLettering failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
