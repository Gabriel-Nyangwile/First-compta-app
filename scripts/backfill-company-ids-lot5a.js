import prisma from "../src/lib/prisma.js";

function hasFlag(name) {
  return process.argv.includes(name);
}

function toLine(label, value) {
  return `${label}: ${value}`;
}

async function main() {
  const apply = hasFlag("--apply");
  const dryRun = !apply;

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const singleCompanyId = companies.length === 1 ? companies[0].id : null;

  const [depreciationLines, moneyAccounts, orphanProducts] = await Promise.all([
    prisma.depreciationLine.findMany({
      where: { companyId: null },
      select: {
        id: true,
        assetId: true,
        asset: { select: { companyId: true, ref: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.moneyAccount.findMany({
      where: { companyId: null },
      select: {
        id: true,
        label: true,
        ledgerAccount: { select: { companyId: true, number: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { companyId: null },
      select: {
        id: true,
        sku: true,
        name: true,
        purchaseOrderLines: { select: { id: true }, take: 1 },
        goodsReceiptLines: { select: { id: true }, take: 1 },
        stockMovements: { select: { id: true }, take: 1 },
        inventoryCountLines: { select: { id: true }, take: 1 },
        invoiceLines: { select: { id: true }, take: 1 },
        incomingInvoiceLines: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const depResolvable = depreciationLines.filter((row) => row.asset?.companyId);
  const depUnresolved = depreciationLines.filter((row) => !row.asset?.companyId);

  const moneyResolvable = moneyAccounts.filter((row) => row.ledgerAccount?.companyId);
  const moneyUnresolved = moneyAccounts.filter((row) => !row.ledgerAccount?.companyId);

  const productResolvable = orphanProducts.filter((row) => {
    const hasRelations =
      row.purchaseOrderLines.length ||
      row.goodsReceiptLines.length ||
      row.stockMovements.length ||
      row.inventoryCountLines.length ||
      row.invoiceLines.length ||
      row.incomingInvoiceLines.length;
    return !hasRelations && singleCompanyId;
  });
  const productUnresolved = orphanProducts.filter((row) => !productResolvable.some((item) => item.id === row.id));

  console.log(toLine("mode", dryRun ? "dry-run" : "apply"));
  console.log(toLine("companies", companies.length));
  if (singleCompanyId) {
    console.log(toLine("singleCompanyId", singleCompanyId));
  }
  console.log(toLine("depreciationLines.resolvable", depResolvable.length));
  console.log(toLine("depreciationLines.unresolved", depUnresolved.length));
  console.log(toLine("moneyAccounts.resolvable", moneyResolvable.length));
  console.log(toLine("moneyAccounts.unresolved", moneyUnresolved.length));
  console.log(toLine("products.resolvable", productResolvable.length));
  console.log(toLine("products.unresolved", productUnresolved.length));

  if (dryRun) {
    if (depResolvable.length) {
      console.log("\nSample depreciationLines:");
      for (const row of depResolvable.slice(0, 5)) {
        console.log(`- ${row.id} <- asset ${row.asset?.ref} (${row.asset?.companyId})`);
      }
    }
    if (moneyResolvable.length) {
      console.log("\nSample moneyAccounts:");
      for (const row of moneyResolvable.slice(0, 5)) {
        console.log(`- ${row.id} <- ledger ${row.ledgerAccount?.number} (${row.ledgerAccount?.companyId})`);
      }
    }
    if (productResolvable.length) {
      console.log("\nResolvable orphan products:");
      for (const row of productResolvable.slice(0, 5)) {
        console.log(`- ${row.id} ${row.sku} -> ${singleCompanyId}`);
      }
    }
    if (depUnresolved.length || moneyUnresolved.length || productUnresolved.length) {
      console.log("\nUnresolved rows remain.");
    }
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of depResolvable) {
      await tx.depreciationLine.update({
        where: { id: row.id },
        data: { companyId: row.asset.companyId },
      });
    }
    for (const row of moneyResolvable) {
      await tx.moneyAccount.update({
        where: { id: row.id },
        data: { companyId: row.ledgerAccount.companyId },
      });
    }
    for (const row of productResolvable) {
      await tx.product.update({
        where: { id: row.id },
        data: { companyId: singleCompanyId },
      });
    }
  });

  console.log("\nBackfill applied.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
