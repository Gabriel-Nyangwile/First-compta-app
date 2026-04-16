#!/usr/bin/env node
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const outDir = path.resolve("scripts", "templates");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function balanceTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Balance");
  // Colonnes harmonisées avec import-opening-balance.js
  ws.addRow(["accountNumber", "label", "debit", "credit"]);
  // Exemples réalistes équilibrés avec comptes standards (débit = crédit = 70000)
  ws.addRow(["101100", "Capital social", 0, 50000]);
  ws.addRow(["106100", "Réserve légale", 0, 5000]);
  ws.addRow(["109000", "Apporteurs - capital souscrit non appelé", 10000, 0]);
  ws.addRow(["512000", "Banque - compte courant", 25000, 0]);
  ws.addRow(["401000", "Fournisseurs", 0, 15000]);
  ws.addRow(["411000", "Clients", 20000, 0]);
  ws.addRow(["310000", "Stocks de matières premières", 8000, 0]);
  ws.addRow(["512000", "Banque - compte d'épargne", 5000, 0]);
  ws.addRow(["213000", "Créances diverses", 2000, 0]); // Ajustement pour équilibrer
  const file = path.join(outDir, "opening-balance-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function stockTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock");
  // Colonnes harmonisées avec import-opening-stock.js
  ws.addRow(["sku", "name", "qty", "unitCost", "inventoryAccountNumber", "stockVariationAccountNumber"]);
  // Exemples réalistes
  ws.addRow(["STK-001", "Ordinateur portable Dell", 5, 800, "310000", "603000"]);
  ws.addRow(["STK-002", "Matière première - acier", 100, 25, "310000", "603000"]);
  ws.addRow(["STK-003", "Produit fini - chaise ergonomique", 20, 150, "310000", "603000"]);
  ws.addRow(["STK-004", "Consommable - cartouches encre", 50, 45, "310000", "603000"]);
  const file = path.join(outDir, "opening-stock-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function assetsTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Immobilisations");
  // Colonnes harmonisées avec import-opening-assets.js (toutes requises)
  ws.addRow([
    "assetCode",
    "name",
    "categoryCode",
    "acquisitionDate",
    "acquisitionCost",
    "accumulatedDepreciation",
    "netBookValue",
    "remainingLifeMonths",
    "salvage",
  ]);
  // Exemples réalistes avec calculs cohérents (acquisitionCost - accumulatedDepreciation = netBookValue)
  ws.addRow(["IMMO-001", "Véhicule utilitaire Peugeot", "MMTMTV5150", "2023-06-01", 25000, 5000, 20000, 36, 2000]);
  ws.addRow(["IMMO-002", "Ordinateur portable professionnel", "MMAMIN4200", "2024-01-15", 1200, 240, 960, 48, 0]);
  ws.addRow(["IMMO-003", "Mobilier de bureau", "MMAMOB4400", "2022-09-01", 8000, 3200, 4800, 60, 400]);
  ws.addRow(["IMMO-004", "Logiciel de gestion ERP", "IMILOG3000", "2023-03-01", 15000, 3000, 12000, 72, 0]);
  const file = path.join(outDir, "opening-assets-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function arTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Clients");
  // Colonnes harmonisées avec import-opening-ar.js
  ws.addRow([
    "clientCode",
    "name",
    "email",
    "phone",
    "address",
    "accountNumber",
    "openingBalance",
  ]);
  // Exemples réalistes
  ws.addRow(["CLI-001", "SARL Dupont & Fils", "contact@dupont.fr", "01.42.33.44.55", "123 Rue de la Paix, 75001 Paris", "411000", 15000]);
  ws.addRow(["CLI-002", "M. Jean Martin", "jean.martin@email.com", "06.12.34.56.78", "45 Avenue des Champs, 69000 Lyon", "411000", 8750]);
  ws.addRow(["CLI-003", "SAS Tech Solutions", "admin@techsolutions.fr", "04.91.23.45.67", "8 Boulevard de la Mer, 13000 Marseille", "411000", 22300]);
  ws.addRow(["CLI-004", "Madame Claire Dubois", "c.dubois@orange.fr", "02.40.12.34.56", "17 Place du Commerce, 44000 Nantes", "411000", 5600]);
  const file = path.join(outDir, "opening-ar-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function apTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Fournisseurs");
  // Colonnes harmonisées avec import-opening-ap.js
  ws.addRow([
    "supplierCode",
    "name",
    "email",
    "phone",
    "address",
    "accountNumber",
    "openingBalance",
  ]);
  // Exemples réalistes
  ws.addRow(["FOU-001", "SAS Fournitures Bureau", "commandes@fournitures.fr", "01.45.67.89.01", "25 Rue du Commerce, 75015 Paris", "401000", 12000]);
  ws.addRow(["FOU-002", "M. Pierre Leroy Matériaux", "p.leroy@matos.com", "03.83.12.34.56", "78 Avenue Industrielle, 54000 Nancy", "401000", 18750]);
  ws.addRow(["FOU-003", "SARL Informatique Plus", "ventes@info-plus.fr", "05.61.23.45.67", "12 Boulevard des Technologies, 31000 Toulouse", "401000", 9500]);
  ws.addRow(["FOU-004", "Madame Sophie Bernard Services", "s.bernard@services.fr", "02.51.67.89.01", "34 Rue des Services, 35000 Rennes", "401000", 6800]);
  const file = path.join(outDir, "opening-ap-template.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

async function main() {
  const a = await balanceTemplate();
  const b = await stockTemplate();
  const c = await assetsTemplate();
  const d = await arTemplate();
  const e = await apTemplate();
  console.log("Templates harmonisés générés:");
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
