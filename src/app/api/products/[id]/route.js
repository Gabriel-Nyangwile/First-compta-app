import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  STOCK_NATURES,
  validateProductLedgerAccounts,
} from "@/lib/productLedger";

function toNumber(value) {
  if (value && typeof value === "object" && typeof value.toNumber === "function") {
    try {
      return value.toNumber();
    } catch {
      return Number(value ?? 0);
    }
  }
  return Number(value ?? 0);
}

export async function GET(_req, { params }) {
  const p = await params;
  const { id } = p || {};
  if (!id) {
    return NextResponse.json(
      { error: "Paramètre id manquant." },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        inventoryAccount: { select: { id: true, number: true, label: true } },
        stockVariationAccount: {
          select: { id: true, number: true, label: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produit introuvable." },
        { status: 404 }
      );
    }

    const inventory = await prisma.productInventory.findUnique({
      where: { productId: id },
    });

    const movements = await prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { date: "desc" },
      take: 200,
      select: {
        id: true,
        date: true,
        movementType: true,
        stage: true,
        quantity: true,
        unitCost: true,
        totalCost: true,
        voucherRef: true,
      },
    });

    const normalizedMovements = movements.map((movement) => ({
      ...movement,
      quantity: toNumber(movement.quantity),
      unitCost:
        movement.unitCost != null ? toNumber(movement.unitCost) : null,
      totalCost:
        movement.totalCost != null ? toNumber(movement.totalCost) : null,
      date: movement.date?.toISOString?.() ?? movement.date ?? null,
    }));

    return NextResponse.json({
      product,
      inventory: {
        qtyOnHand: inventory?.qtyOnHand ?? "0",
        avgCost: inventory?.avgCost ?? null,
      },
      movements: normalizedMovements,
    });
  } catch (error) {
    console.error("GET /api/products/[id]", error);
    return NextResponse.json(
      { error: "Erreur récupération produit." },
      { status: 500 }
    );
  }
}

export async function PATCH(_req, { params }) {
  const p = await params; // Next 15 async params support
  const { id } = p;
  try {
    const body = await _req.json();
    const data = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const hasStockNature = Object.prototype.hasOwnProperty.call(
      body,
      "stockNature"
    );
    if (hasStockNature) {
      const rawNature = body.stockNature ? String(body.stockNature) : "";
      if (!STOCK_NATURES.has(rawNature)) {
        return NextResponse.json(
          { error: "stockNature invalide." },
          { status: 400 }
        );
      }
      data.stockNature = rawNature;
    }

    const hasInventoryAccount = Object.prototype.hasOwnProperty.call(
      body,
      "inventoryAccountId"
    );
    if (hasInventoryAccount) {
      if (!body.inventoryAccountId) {
        return NextResponse.json(
          { error: "inventoryAccountId requis." },
          { status: 400 }
        );
      }
      data.inventoryAccountId = String(body.inventoryAccountId);
    }

    const hasVariationAccount = Object.prototype.hasOwnProperty.call(
      body,
      "stockVariationAccountId"
    );
    if (hasVariationAccount) {
      if (!body.stockVariationAccountId) {
        return NextResponse.json(
          { error: "stockVariationAccountId requis." },
          { status: 400 }
        );
      }
      data.stockVariationAccountId = String(body.stockVariationAccountId);
    }

    if (!Object.keys(data).length) {
      return NextResponse.json(
        { error: "Aucune mise à jour." },
        { status: 400 }
      );
    }

    const touchesLedgerConfig =
      hasStockNature || hasInventoryAccount || hasVariationAccount;

    let productForValidation = null;
    if (touchesLedgerConfig) {
      productForValidation = await prisma.product.findUnique({
        where: { id },
        select: {
          stockNature: true,
          inventoryAccountId: true,
          stockVariationAccountId: true,
        },
      });
      if (!productForValidation) {
        return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      }
      const nextStockNature = data.stockNature ?? productForValidation.stockNature;
      const nextInventoryAccountId =
        data.inventoryAccountId ?? productForValidation.inventoryAccountId;
      const nextVariationAccountId =
        data.stockVariationAccountId ??
        productForValidation.stockVariationAccountId;

      try {
        await validateProductLedgerAccounts(prisma, {
          stockNature: nextStockNature,
          inventoryAccountId: nextInventoryAccountId,
          stockVariationAccountId: nextVariationAccountId,
        });
      } catch (validationError) {
        return NextResponse.json(
          { error: validationError.message },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        inventoryAccount: { select: { id: true, number: true, label: true } },
        stockVariationAccount: {
          select: { id: true, number: true, label: true },
        },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }
    console.error("PATCH /api/products/[id]", e);
    return NextResponse.json(
      { error: "Erreur mise à jour produit." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  const p = await params;
  const { id } = p;
  try {
    // Attempt delete; will throw if FK constraints
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === "P2003" || e.code === "P2014") {
      return NextResponse.json(
        { error: "Produit référencé; désactivez-le à la place." },
        { status: 409 }
      );
    }
    console.error("DELETE /api/products/[id]", e);
    return NextResponse.json(
      { error: "Erreur suppression produit." },
      { status: 500 }
    );
  }
}
