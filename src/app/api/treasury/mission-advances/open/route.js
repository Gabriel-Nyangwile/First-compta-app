import { NextResponse } from "next/server";
import { listOpenMissionAdvances } from "@/lib/serverActions/money";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || null;
    const advances = await listOpenMissionAdvances({ companyId, employeeId });
    return NextResponse.json({ advances });
  } catch (error) {
    console.error("GET /api/treasury/mission-advances/open", error);
    return NextResponse.json(
      { error: error.message || "Erreur chargement avances de mission" },
      { status: 500 }
    );
  }
}
