import { NextResponse } from "next/server";
import { matchClientPaymentAction } from "@/lib/serverActions/clients";

export async function POST(req, { params }) {
  const { id: clientId } = params;
  const body = await req.json().catch(() => ({}));
  const { movementId } = body || {};

  if (!movementId) {
    return NextResponse.json({ error: "movementId requis" }, { status: 400 });
  }

  try {
    const result = await matchClientPaymentAction({ movementId });
    return NextResponse.json(result);
  } catch (error) {
    console.error("matchClientPaymentAction failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
