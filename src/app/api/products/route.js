import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  STOCK_NATURES,
  validateProductLedgerAccounts,
} from "@/lib/productLedger";
import { requireCompanyId } from "@/lib/tenant";

// GET /api/products?q=term&active=1
export async function GET(request) {
  const companyId = requireCompanyId(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const active = searchParams.get("active");
  const where = q
    ? {
        companyId,
        OR: [
          { sku: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : { companyId };
  try {
    let products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        inventoryAccount: { select: { id: true, number: true, label: true } },
        stockVariationAccount: {
          select: { id: true, number: true, label: true },
        },
      },
    });
    if (active === "0") {
      products = products.filter((product) => product.isActive === false);
    } else if (active === "1") {
      products = products.filter((product) => product.isActive !== false);
    }
    return NextResponse.json(products);
  } catch (e) {
    console.error("GET /products error", e);
    return NextResponse.json(
      { error: "Erreur récupération produits." },
      { status: 500 }
    );
  }
}

// POST /api/products { sku, name, description?, unit?, stockNature?, inventoryAccountId, stockVariationAccountId }
export async function POST(request) {
  try {
    const companyId = requireCompanyId(request);
    const body = await request.json();
    const sku = String(body.sku || "").trim();
    const name = String(body.name || "").trim();
    const description = body.description
      ? String(body.description).trim()
      : undefined;
    const unit = body.unit ? String(body.unit) : undefined;
    const stockNatureRaw = body.stockNature ? String(body.stockNature) : null;
    const stockNature = STOCK_NATURES.has(stockNatureRaw)
      ? stockNatureRaw
      : "PURCHASED";
    const inventoryAccountId = body.inventoryAccountId
      ? String(body.inventoryAccountId)
      : null;
    const stockVariationAccountId = body.stockVariationAccountId
      ? String(body.stockVariationAccountId)
      : null;
    if (!sku || !name) {
      return NextResponse.json(
        { error: "sku et name requis." },
        { status: 400 }
      );
    }

    let accounts;
    try {
      accounts = await validateProductLedgerAccounts(prisma, {
        stockNature,
        inventoryAccountId,
        stockVariationAccountId,
        companyId,
      });
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        sku,
        name,
        description,
        unit,
        stockNature,
        inventoryAccountId,
        stockVariationAccountId,
      },
      include: {
        inventoryAccount: { select: { id: true, number: true, label: true } },
        stockVariationAccount: {
          select: { id: true, number: true, label: true },
        },
      },
    });
    return NextResponse.json(
      {
        ...product,
        inventoryAccount: accounts.inventory,
        stockVariationAccount: accounts.variation,
      },
      { status: 201 }
    );
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "SKU déjà utilisé." }, { status: 409 });
    }
    console.error("POST /products error", e);
    return NextResponse.json(
      { error: "Erreur création produit." },
      { status: 500 }
    );
  }
}
