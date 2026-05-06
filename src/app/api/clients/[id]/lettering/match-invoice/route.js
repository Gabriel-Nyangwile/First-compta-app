import { NextResponse } from "next/server";
import { matchClientInvoiceAction } from "@/lib/serverActions/clients";
import { requireCompanyId } from "@/lib/tenant";

export async function POST(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id: clientId } = await params;
  const body = await req.json().catch(() => ({}));
  const { invoiceId } = body || {};

  if (!clientId) {
    return NextResponse.json({ error: "clientId requis" }, { status: 400 });
  }
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId requis" }, { status: 400 });
  }

  try {
    const result = await matchClientInvoiceAction({
      invoiceId,
      clientId,
      companyId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("matchClientInvoiceAction failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
