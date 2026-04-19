import { NextResponse } from "next/server";
import { createMissionAdvanceRegularization } from "@/lib/serverActions/money";
import { requireCompanyId } from "@/lib/tenant";

export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const regularization = await createMissionAdvanceRegularization({
      companyId,
      advanceMovementId: body.advanceMovementId,
      expenseAccountId: body.expenseAccountId,
      amount: body.amount,
      date: body.date,
      supportRef: body.supportRef,
      description: body.description,
    });
    return NextResponse.json({ ok: true, regularization }, { status: 201 });
  } catch (error) {
    console.error("POST /api/treasury/mission-advance-regularizations", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur régularisation avance de mission" },
      { status: error?.statusCode || 400 }
    );
  }
}
