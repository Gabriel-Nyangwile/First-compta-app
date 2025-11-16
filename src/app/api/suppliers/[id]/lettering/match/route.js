import { NextResponse } from "next/server";
import { matchSupplierPaymentAction } from "@/lib/serverActions/suppliers";

export async function POST(req, { params }) {
  const { id: supplierId } = params;
  const body = await req.json().catch(() => ({}));
  const { movementId } = body || {};

  if (!movementId) {
    return NextResponse.json({ error: "movementId requis" }, { status: 400 });
  }

  try {
    const result = await matchSupplierPaymentAction({ movementId });
    return NextResponse.json(result);
  } catch (error) {
    console.error("matchSupplierPaymentAction failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
