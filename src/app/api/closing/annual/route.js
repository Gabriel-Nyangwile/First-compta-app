import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/tenant";
import { checkPerm, getUserRole } from "@/lib/authz";
import {
  calculateAnnualClosing,
  generateAnnualOpening,
} from "@/lib/closing/annual";

async function requireClosingPermission(request) {
  const role = await getUserRole(request);
  if (!checkPerm("manageClosing", role)) {
    const error = new Error("Acces refuse : role insuffisant");
    error.status = 403;
    throw error;
  }
}

export async function GET(request) {
  try {
    await requireClosingPermission(request);
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));
    const report = await calculateAnnualClosing({
      companyId,
      year,
      profitAccountNumber: searchParams.get("profitAccountNumber") || "121100",
      lossAccountNumber: searchParams.get("lossAccountNumber") || "129100",
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("GET /api/closing/annual error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur controle cloture" },
      { status: error.status || 400 }
    );
  }
}

export async function POST(request) {
  try {
    await requireClosingPermission(request);
    const companyId = requireCompanyId(request);
    const body = await request.json().catch(() => ({}));
    const report = await generateAnnualOpening({
      companyId,
      year: Number(body.year),
      profitAccountNumber: body.profitAccountNumber || "121100",
      lossAccountNumber: body.lossAccountNumber || "129100",
    });
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("POST /api/closing/annual error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur generation a-nouveaux" },
      { status: error.status || 400 }
    );
  }
}
