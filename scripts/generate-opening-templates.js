#!/usr/bin/env node
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const outDir = path.resolve("scripts", "templates");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function balanceTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Balance");
  ws.addRow(["accountNumber", "accountLabel", "debit", "credit"]);
  ws.addRow(["101100", "Capital souscrit non appelé", 0, 100000]);
  ws.addRow(["109000", "Apporteurs, capital souscrit non appelé", 100000, 0]);
  const file = path.join(outDir, "opening-balance-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function stockTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock");
  ws.addRow([
    "sku",
    "name",
    "qty",
    "unitCost",
    "inventoryAccountNumber",
    "stockVariationAccountNumber",
  ]);
  ws.addRow(["STK-001", "Produit A", 10, 25, "310000", "603000"]);
  const file = path.join(outDir, "opening-stock-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function assetsTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Immobilisations");
  ws.addRow([
    "assetCode",
    "name",
    "categoryCode",
    "acquisitionDate",
    "acquisitionCost",
    "accumulatedDepreciation",
    "remainingLifeMonths",
    "salvage",
  ]);
  ws.addRow(["IMMO-001", "Vehicule utilitaire", "VEHICULES", "2023-06-01", 25000, 5000, 36, 0]);
  const file = path.join(outDir, "opening-assets-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function arTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Clients");
  ws.addRow([
    "clientCode",
    "name",
    "accountNumber",
    "openingBalance",
    "email",
    "phone",
    "address",
  ]);
  ws.addRow(["CLI-001", "Client Exemple", "411000", 15000, "client@example.com", "", ""]);
  const file = path.join(outDir, "opening-clients-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function apTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Fournisseurs");
  ws.addRow([
    "supplierCode",
    "name",
    "accountNumber",
    "openingBalance",
    "email",
    "phone",
    "address",
  ]);
  ws.addRow(["FOU-001", "Fournisseur Exemple", "401000", 12000, "fou@example.com", "", ""]);
  const file = path.join(outDir, "opening-suppliers-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function main() {
  const a = await balanceTemplate();
  const b = await stockTemplate();
  const c = await assetsTemplate();
  const d = await arTemplate();
  const e = await apTemplate();
  console.log("Templates generated:");
  console.log(" -", a);
  console.log(" -", b);
  console.log(" -", c);
  console.log(" -", d);
  console.log(" -", e);
}

main().catch((err) => {
  console.error("Template generation error:", err);
  process.exit(1);
});
