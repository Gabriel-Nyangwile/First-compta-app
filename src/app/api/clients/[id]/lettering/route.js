import { NextResponse } from "next/server";
// TODO: Créer getClientLettering dans src/lib/serverActions/ledgers
import { getClientLettering } from "@/lib/serverActions/ledgers";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  const clientId = id;
  if (!clientId) {
    return NextResponse.json({ error: "clientId requis" }, { status: 400 });
  }
  try {
    const data = await getClientLettering({ clientId, companyId });
    return NextResponse.json(data);
  } catch (error) {
    console.error("getClientLettering failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
