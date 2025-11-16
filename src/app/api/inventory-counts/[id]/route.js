import { NextResponse } from "next/server";
import {
  cancelInventoryCount,
  completeInventoryCount,
  getInventoryCount,
  postInventoryCount,
  recordInventoryCountLine,
} from "@/lib/inventoryCount";
import { requireInventoryPermission } from "@/app/api/_lib/auth";

async function resolveParams(context) {
  if (context?.params) {
    if (typeof context.params.then === "function") {
      return context.params.then((value) => value ?? {});
    }
    return context.params;
  }
  return context ?? {};
}

export async function GET(_request, context) {
  try {
    const params = await resolveParams(context);
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );
    }
    const count = await getInventoryCount(id);
    return NextResponse.json(count);
  } catch (error) {
    if (error?.message === "INVENTORY_COUNT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Inventaire introuvable." },
        { status: 404 }
      );
    }
    console.error("GET /inventory-counts/[id] error", error);
    return NextResponse.json(
      { error: "Erreur récupération inventaire." },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  try {
    requireInventoryPermission(request);
    const params = await resolveParams(context);
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Paramètre id manquant." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toUpperCase();

    if (!action) {
      return NextResponse.json(
        { error: "Action requise." },
        { status: 400 }
      );
    }

    if (action === "UPDATE_LINE") {
      const lineId = body?.lineId;
      const countedQty = body?.countedQty;
      if (!lineId) {
        return NextResponse.json(
          { error: "lineId requis." },
          { status: 400 }
        );
      }
      const updated = await recordInventoryCountLine({
        inventoryCountId: id,
        lineId,
        countedQty,
      });
      return NextResponse.json(updated);
    }

    if (action === "COMPLETE") {
      const updated = await completeInventoryCount(id);
      return NextResponse.json(updated);
    }

    if (action === "POST") {
      const updated = await postInventoryCount(id);
      return NextResponse.json(updated);
    }

    if (action === "CANCEL") {
      const updated = await cancelInventoryCount(id);
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Action inventaire non prise en charge." },
      { status: 400 }
    );
  } catch (error) {
    if (error?.message === "INVENTORY_COUNT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Inventaire introuvable." },
        { status: 404 }
      );
    }
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Accès inventaire restreint." },
        { status: 401 }
      );
    }
    if (error?.message?.startsWith("Aucun produit")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error?.message?.includes("Impossible de modifier") ||
      error?.message?.includes("Toutes les lignes doivent") ||
      error?.message?.includes("Comptes inventaire") ||
      error?.message?.includes("Inventaire annulé") ||
      error?.message?.includes("doit être validé") ||
      error?.message?.includes("Quantité inventoriée invalide.")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PUT /inventory-counts/[id] error", error);
    return NextResponse.json(
      { error: "Erreur traitement inventaire." },
      { status: 500 }
    );
  }
}
