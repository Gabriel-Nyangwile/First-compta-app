import { NextResponse } from "next/server";
import {
  createInventoryCount,
  listInventoryCounts,
} from "@/lib/inventoryCount";
import { requireInventoryPermission } from "@/app/api/_lib/auth";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(request) {
  try {
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const counts = await listInventoryCounts({ companyId, status });
    return NextResponse.json(counts);
  } catch (error) {
    console.error("GET /inventory-counts error", error);
    return NextResponse.json(
      { error: "Erreur récupération inventaires." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    requireInventoryPermission(request);
    const companyId = requireCompanyId(request);
    const body = await request.json().catch(() => ({}));
    const {
      productIds = null,
      countedAt = null,
      notes = null,
      createdById = null,
    } = body || {};

    const result = await createInventoryCount({
      companyId,
      productIds: Array.isArray(productIds) ? productIds : null,
      countedAt,
      notes,
      createdById,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Accès inventaire restreint." },
        { status: 401 }
      );
    }
    if (error?.message === "Aucun produit correspondant pour l'inventaire.") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /inventory-counts error", error);
    return NextResponse.json(
      { error: "Erreur création inventaire." },
      { status: 500 }
    );
  }
}
