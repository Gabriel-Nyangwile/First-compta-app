import prisma from "@/lib/prisma";

export const STOCK_NATURES = new Set(["PURCHASED", "PRODUCED"]);
export const INVENTORY_ACCOUNT_PREFIX = "31";

export const VARIATION_ACCOUNT_PREFIX = {
  PURCHASED: "603",
  PRODUCED: "701",
};

export async function validateProductLedgerAccounts(
  client,
  { stockNature, inventoryAccountId, stockVariationAccountId, companyId }
) {
  const prismaClient = client || prisma;
  if (!inventoryAccountId || !stockVariationAccountId) {
    throw new Error(
      "Compte de stock (31x) et compte de variation (603/701) requis."
    );
  }

  const accounts = await prismaClient.account.findMany({
    where: {
      id: { in: [inventoryAccountId, stockVariationAccountId] },
      ...(companyId ? { companyId } : {}),
    },
    select: { id: true, number: true, label: true },
  });

  const inventory = accounts.find((a) => a.id === inventoryAccountId);
  if (!inventory) {
    throw new Error("Compte de stock introuvable.");
  }
  if (!inventory.number?.startsWith(INVENTORY_ACCOUNT_PREFIX)) {
    throw new Error("Le compte de stock doit commencer par 31.");
  }

  const variation = accounts.find((a) => a.id === stockVariationAccountId);
  if (!variation) {
    throw new Error("Compte de variation introuvable.");
  }
  const expectedPrefix =
    VARIATION_ACCOUNT_PREFIX[stockNature] || VARIATION_ACCOUNT_PREFIX.PURCHASED;
  if (!variation.number?.startsWith(expectedPrefix)) {
    throw new Error(
      `Le compte de variation doit commencer par ${expectedPrefix}.`
    );
  }

  return { inventory, variation };
}
