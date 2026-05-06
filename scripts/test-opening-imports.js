#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import prisma from "../src/lib/prisma.js";

const openingDate = "2026-01-01";

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function runNodeScript(script, args, { expectFailure = false } = {}) {
  try {
    const output = execFileSync(
      process.execPath,
      ["--env-file=.env.local", script, ...args],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    if (expectFailure) {
      throw new Error(`${script} devait echouer mais a reussi.`);
    }
    return output;
  } catch (error) {
    if (expectFailure) {
      const stderr = error.stderr?.toString?.() || "";
      const stdout = error.stdout?.toString?.() || "";
      return `${stdout}${stderr}`;
    }
    const stderr = error.stderr?.toString?.() || "";
    throw new Error(`${script} failed: ${stderr || error.message}`);
  }
}

async function writeWorkbook(filePath, sheetName, headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRow(headers);
  for (const row of rows) worksheet.addRow(row);
  await workbook.xlsx.writeFile(filePath);
}

async function createFixtures(tmpDir) {
  const files = {
    balance: path.join(tmpDir, "opening-balance.xlsx"),
    stock: path.join(tmpDir, "opening-stock.xlsx"),
    ar: path.join(tmpDir, "opening-ar.xlsx"),
    ap: path.join(tmpDir, "opening-ap.xlsx"),
    assets: path.join(tmpDir, "opening-assets.xlsx"),
  };

  await writeWorkbook(
    files.balance,
    "Balance",
    ["accountNumber", "label", "debit", "credit"],
    [
      ["101100", "Capital social test", 0, 10000],
      ["512000", "Banque test", 10000, 0],
    ]
  );
  await writeWorkbook(
    files.stock,
    "Stock",
    [
      "sku",
      "name",
      "qty",
      "unitCost",
      "inventoryAccountNumber",
      "stockVariationAccountNumber",
    ],
    [["OPEN-STK-001", "Article ouverture", 3, 12.5, "310000", "603000"]]
  );
  await writeWorkbook(
    files.ar,
    "Clients",
    [
      "clientCode",
      "name",
      "email",
      "phone",
      "address",
      "accountNumber",
      "openingBalance",
    ],
    [["CLI-OPEN-001", "Client ouverture", "client-opening@example.test", "", "", "411001", 250]]
  );
  await writeWorkbook(
    files.ap,
    "Fournisseurs",
    [
      "supplierCode",
      "name",
      "email",
      "phone",
      "address",
      "accountNumber",
      "openingBalance",
    ],
    [["FOU-OPEN-001", "Fournisseur ouverture", "supplier-opening@example.test", "", "", "401001", 125]]
  );
  await writeWorkbook(
    files.assets,
    "Immobilisations",
    [
      "assetCode",
      "name",
      "categoryCode",
      "acquisitionDate",
      "acquisitionCost",
      "accumulatedDepreciation",
      "netBookValue",
      "remainingLifeMonths",
      "salvage",
    ],
    [["ASSET-OPEN-001", "Immobilisation ouverture", "OPEN-TEST", "2024-01-01", 1000, 200, 800, 24, 0]]
  );

  return files;
}

async function createCompanyFixture(runId) {
  const company = await prisma.company.create({
    data: {
      name: `OPENING TEST ${runId}`,
      currency: "XOF",
      country: "CD",
      fiscalYearStart: "01-01",
    },
    select: { id: true },
  });

  await prisma.account.createMany({
    data: [
      { companyId: company.id, number: "101100", label: "Capital social test" },
      { companyId: company.id, number: "512000", label: "Banque test" },
      { companyId: company.id, number: "310000", label: "Stock test" },
      { companyId: company.id, number: "603000", label: "Variation stock test" },
      { companyId: company.id, number: "471000", label: "Compte attente ouverture" },
      { companyId: company.id, number: "218000", label: "Immobilisations test" },
      { companyId: company.id, number: "281800", label: "Amortissements test" },
      { companyId: company.id, number: "681100", label: "Dotations test" },
    ],
  });

  await prisma.assetCategory.create({
    data: {
      companyId: company.id,
      code: "OPEN-TEST",
      label: "Categorie ouverture test",
      durationMonths: 36,
      assetAccountNumber: "218000",
      depreciationAccountNumber: "281800",
      expenseAccountNumber: "681100",
    },
  });

  return company;
}

async function cleanupCompany(companyId) {
  if (!companyId) return;
  await prisma.depreciationLine.deleteMany({ where: { companyId } });
  await prisma.stockMovement.deleteMany({ where: { companyId } });
  await prisma.productInventory.deleteMany({ where: { companyId } });
  await prisma.transaction.deleteMany({ where: { companyId } });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.asset.deleteMany({ where: { companyId } });
  await prisma.assetCategory.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.client.deleteMany({ where: { companyId } });
  await prisma.supplier.deleteMany({ where: { companyId } });
  await prisma.sequence.deleteMany({ where: { companyId } });
  await prisma.account.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => null);
}

async function verifyOpening(companyId) {
  const [journals, transactions, product, inventory, stockMovements, clients, suppliers, assets, depreciationLines] =
    await Promise.all([
      prisma.journalEntry.findMany({ where: { companyId } }),
      prisma.transaction.findMany({ where: { companyId } }),
      prisma.product.findUnique({
        where: { companyId_sku: { companyId, sku: "OPEN-STK-001" } },
      }),
      prisma.productInventory.findFirst({ where: { companyId } }),
      prisma.stockMovement.findMany({ where: { companyId } }),
      prisma.client.findMany({ where: { companyId } }),
      prisma.supplier.findMany({ where: { companyId } }),
      prisma.asset.findMany({ where: { companyId } }),
      prisma.depreciationLine.findMany({ where: { companyId } }),
    ]);

  assert(journals.length >= 4, "Journaux d'ouverture insuffisants.", { journals: journals.length });
  assert(transactions.length >= 9, "Transactions d'ouverture insuffisantes.", { transactions: transactions.length });
  assert(product, "Produit de stock d'ouverture non cree.");
  assert(Number(inventory?.qtyOnHand ?? 0) === 3, "Stock d'ouverture incoherent.", inventory);
  assert(stockMovements.length === 1, "Mouvement stock d'ouverture incoherent.", { stockMovements: stockMovements.length });
  assert(clients.length === 1, "Client d'ouverture non cree.", { clients: clients.length });
  assert(suppliers.length === 1, "Fournisseur d'ouverture non cree.", { suppliers: suppliers.length });
  assert(assets.length === 1, "Immobilisation d'ouverture non creee.", { assets: assets.length });
  assert(depreciationLines.length === 1, "Ligne d'amortissement d'ouverture non creee.", { depreciationLines: depreciationLines.length });
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `first-compta-opening-${runId}-`));
  let companyId = null;

  try {
    const files = await createFixtures(tmpDir);
    const company = await createCompanyFixture(runId);
    companyId = company.id;

    const commonArgs = ["--company", companyId, "--date", openingDate];
    for (const [script, file] of [
      ["scripts/import-opening-balance.js", files.balance],
      ["scripts/import-opening-stock.js", files.stock],
      ["scripts/import-opening-ar.js", files.ar],
      ["scripts/import-opening-ap.js", files.ap],
      ["scripts/import-opening-assets.js", files.assets],
    ]) {
      runNodeScript(script, ["--file", file, ...commonArgs, "--dry-run"]);
      runNodeScript(script, ["--file", file, ...commonArgs]);
    }

    const duplicateOutput = runNodeScript(
      "scripts/import-opening-balance.js",
      ["--file", files.balance, ...commonArgs],
      { expectFailure: true }
    );
    assert(
      duplicateOutput.includes("Import duplicated detected"),
      "Le garde anti-reimport balance n'a pas ete declenche.",
      duplicateOutput
    );

    await verifyOpening(companyId);
    console.log("Opening imports smoke OK");
  } finally {
    await cleanupCompany(companyId);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error("test-opening-imports error:", error.message || error);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
