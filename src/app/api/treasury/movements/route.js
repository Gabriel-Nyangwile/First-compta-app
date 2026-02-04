import { NextResponse } from "next/server";
import {
  createMoneyMovement,
  listMoneyMovements,
} from "@/lib/serverActions/money";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const { searchParams } = new URL(req.url);
    const moneyAccountId = searchParams.get("moneyAccountId");
    if (!moneyAccountId) {
      return NextResponse.json(
        { error: "moneyAccountId requis" },
        { status: 400 }
      );
    }
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );
    const cursor = searchParams.get("cursor") || undefined;
    const supplierId = searchParams.get("supplierId") || undefined;
    const incomingInvoiceId =
      searchParams.get("incomingInvoiceId") || undefined;
    const invoiceId = searchParams.get("invoiceId") || undefined;
    const directionParam = searchParams.get("direction");
    const direction = directionParam ? directionParam.toUpperCase() : undefined;
    const kind = searchParams.get("kind") || undefined;

    const { rows, nextCursor } = await listMoneyMovements({
      companyId,
      moneyAccountId,
      supplierId,
      incomingInvoiceId,
      invoiceId,
      direction,
      kind,
      limit,
      cursor,
    });
    return NextResponse.json({ movements: rows, nextCursor });
  } catch (err) {
    console.error("GET /api/treasury/movements", err);
    return NextResponse.json(
      { error: err.message || "Erreur lors de la récupération des mouvements" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const normalizedDirection = body.direction
      ? String(body.direction).toUpperCase()
      : undefined;
    const normalizedKind = body.kind ? String(body.kind) : undefined;

    if (!body.moneyAccountId) {
      return NextResponse.json(
        { ok: false, error: "moneyAccountId requis" },
        { status: 400 }
      );
    }
    if (body.amount === undefined || Number(body.amount) <= 0) {
      return NextResponse.json(
        { ok: false, error: "Montant invalide" },
        { status: 400 }
      );
    }
    if (!normalizedDirection || !["IN", "OUT"].includes(normalizedDirection)) {
      return NextResponse.json(
        { ok: false, error: "direction invalide" },
        { status: 400 }
      );
    }
    if (!normalizedKind) {
      return NextResponse.json(
        { ok: false, error: "kind requis" },
        { status: 400 }
      );
    }
    const movement = await createMoneyMovement({
      companyId,
      moneyAccountId: body.moneyAccountId,
      amount: body.amount,
      direction: normalizedDirection,
      kind: normalizedKind,
      description: body.description,
      invoiceId: body.invoiceId,
      incomingInvoiceId: body.incomingInvoiceId,
      supplierId: body.supplierId,
      voucherRef: body.voucherRef,
      counterpartAccountId: body.counterpartAccountId,
      autoPost: body.autoPost ?? true,
      vatBreakdown: body.vatBreakdown,
    });
    return NextResponse.json({ ok: true, movement }, { status: 201 });
  } catch (err) {
    console.error("POST /api/treasury/movements", err);
    const status = err?.statusCode || 400;
    return NextResponse.json(
      { ok: false, error: err.message || "Erreur création mouvement" },
      { status }
    );
  }
}
