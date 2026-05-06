import prisma from "@/lib/prisma";
import {
  STOCK_NATURES,
  getStockNatureConfig,
  formatPrefixes,
  accountMatchesPrefixes,
} from "@/lib/productStockNatures";

export { STOCK_NATURES, getStockNatureConfig, formatPrefixes };

export async function validateProductLedgerAccounts(
  client,
  { stockNature, inventoryAccountId, stockVariationAccountId, companyId }
) {
  const prismaClient = client || prisma;
  const natureConfig = getStockNatureConfig(stockNature);
  if (!inventoryAccountId || !stockVariationAccountId) {
    throw new Error(
      "Compte de stock et compte de variation requis."
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
  if (!accountMatchesPrefixes(inventory, natureConfig.inventoryPrefixes)) {
    throw new Error(
      `Le compte de stock doit commencer par ${formatPrefixes(natureConfig.inventoryPrefixes)}.`
    );
  }

  const variation = accounts.find((a) => a.id === stockVariationAccountId);
  if (!variation) {
    throw new Error("Compte de variation introuvable.");
  }
  if (!accountMatchesPrefixes(variation, natureConfig.variationPrefixes)) {
    throw new Error(
      `Le compte de variation doit commencer par ${formatPrefixes(natureConfig.variationPrefixes)}.`
    );
  }

  return { inventory, variation };
}
