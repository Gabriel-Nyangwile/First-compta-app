import { NextResponse } from "next/server";
import { matchSupplierInvoiceAction } from "@/lib/serverActions/suppliers";
import { requireCompanyId } from "@/lib/tenant";

export async function POST(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id: supplierId } = await params;
  const body = await req.json().catch(() => ({}));
  const { invoiceId } = body || {};

  if (!supplierId) {
    return NextResponse.json({ error: "supplierId requis" }, { status: 400 });
  }
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId requis" }, { status: 400 });
  }

  try {
    const result = await matchSupplierInvoiceAction({
      invoiceId,
      supplierId,
      companyId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("matchSupplierInvoiceAction failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
