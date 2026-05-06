import { NextResponse } from "next/server";
import { checkPerm } from "@/lib/authz";
import { getRequestActor } from "@/lib/requestAuth";
import { requireCompanyId } from "@/lib/tenant";
import { createOrder, listOrders } from "@/lib/production";

export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const orders = await listOrders({
      companyId,
      status: searchParams.get("status"),
      q: searchParams.get("q"),
    });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/production/orders", error);
    return NextResponse.json({ error: error.message || "Erreur ordres de fabrication." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const actor = await getRequestActor(request, { companyId });
    if (!checkPerm("manageProduction", actor.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const order = await createOrder({ companyId, userId: actor.userId, body });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("POST /api/production/orders", error);
    return NextResponse.json({ error: error.message || "Erreur création ordre." }, { status: 400 });
  }
}
