import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { getCompanyIdFromCookies } from "@/lib/tenant";

function toNumber(value) {
  return value?.toNumber?.() ?? Number(value ?? 0);
}

export async function getProductionCompanyId() {
  const cookieStore = await cookies();
  return getCompanyIdFromCookies(cookieStore);
}

export async function getProductionProducts(companyId) {
  if (!companyId) return [];
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ sku: "asc" }],
    include: { inventory: true },
  });
  return products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    unit: product.unit,
    stockNature: product.stockNature,
    inventoryAccountId: product.inventoryAccountId,
    stockVariationAccountId: product.stockVariationAccountId,
    qtyOnHand: product.inventory ? toNumber(product.inventory.qtyOnHand) : 0,
    avgCost: product.inventory?.avgCost == null ? null : toNumber(product.inventory.avgCost),
  }));
}

export async function getProductionAccounts(companyId) {
  if (!companyId) return [];
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      OR: [
        { number: { startsWith: "33" } },
        { number: { startsWith: "34" } },
        { number: { startsWith: "35" } },
        { number: { startsWith: "38" } },
        { number: { startsWith: "471" } },
      ],
    },
    orderBy: { number: "asc" },
    select: { id: true, number: true, label: true },
    take: 100,
  });
  return accounts;
}
