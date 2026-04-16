#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

async function main() {
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID;
  if (!companyId) {
    console.error("DEFAULT_COMPANY_ID not set");
    process.exit(1);
  }

  const code = process.env.CATEGORY_CODE || "MMTMTV5150";
  const label = process.env.CATEGORY_LABEL || "Véhicule utilitaire";
  const durationMonths = Number(process.env.DURATION_MONTHS || 60);

  const existing = await prisma.assetCategory.findUnique({ where: { companyId_code: { companyId, code } } }).catch(() => null);
  if (existing) {
    // If account numbers provided via env, update existing category
    const updateData = {};
    if (process.env.ASSET_ACCOUNT_NUMBER) updateData.assetAccountNumber = process.env.ASSET_ACCOUNT_NUMBER;
    if (process.env.DEP_ACCOUNT_NUMBER) updateData.depreciationAccountNumber = process.env.DEP_ACCOUNT_NUMBER;
    if (process.env.EXPENSE_ACCOUNT_NUMBER) updateData.expenseAccountNumber = process.env.EXPENSE_ACCOUNT_NUMBER;
    if (Object.keys(updateData).length) {
      const updated = await prisma.assetCategory.update({ where: { id: existing.id }, data: updateData });
      console.log(JSON.stringify({ created: false, updated: true, id: updated.id, code }));
      await prisma.$disconnect();
      return;
    }
    console.log(JSON.stringify({ created: false, id: existing.id, code }));
    await prisma.$disconnect();
    return;
  }

  const created = await prisma.assetCategory.create({
    data: {
      companyId,
      code,
      label,
      durationMonths,
      active: true,
      assetAccountNumber: process.env.ASSET_ACCOUNT_NUMBER || null,
      depreciationAccountNumber: process.env.DEP_ACCOUNT_NUMBER || null,
      expenseAccountNumber: process.env.EXPENSE_ACCOUNT_NUMBER || null,
    },
  });

  console.log(JSON.stringify({ created: true, id: created.id, code }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
