#!/usr/bin/env node
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import prisma from "../src/lib/prisma.js";
import { applyAdjustMovement } from "../src/lib/inventory.js";

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function num(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function resolveAccountId(tx, number, companyId) {
  const acc = await tx.account.findFirst({ where: { number, companyId } });
  if (!acc) throw new Error(`Compte introuvable: ${number}`);
  return acc.id;
}

async function main() {
  const file = argValue("--file");
  const sheetName = argValue("--sheet");
  const openingDate =
    argValue("--date") || process.env.OPENING_DATE || "2026-01-01";
  const companyId =
    argValue("--company") || process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID;
  const dryRun = process.argv.includes("--dry-run");

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/import-opening-stock.js --file <xlsx> [--sheet <name>] [--date YYYY-MM-DD] [--dry-run]");
    process.exit(1);
  }
  if (!companyId) {
    throw new Error("DEFAULT_COMPANY_ID requis (ou --company).");
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    throw new Error(`Fichier introuvable: ${abs}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(abs);
  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) throw new Error("Feuille Excel introuvable");

  const headerRow = ws.getRow(1).values;
  const headerMap = new Map();
  headerRow.forEach((h, idx) => {
    if (!h) return;
    headerMap.set(normalizeHeader(h), idx);
  });

  const skuCol = headerMap.get("sku");
  const nameCol = headerMap.get("name") || headerMap.get("designation");
  const qtyCol = headerMap.get("qty") || headerMap.get("quantity");
  const unitCostCol = headerMap.get("unitcost") || headerMap.get("cost");
  const invAccCol =
    headerMap.get("inventoryaccountnumber") || headerMap.get("inventory_account");
  const varAccCol =
    headerMap.get("stockvariationaccountnumber") || headerMap.get("variation_account");

  if (!skuCol || qtyCol == null || unitCostCol == null) {
    throw new Error("Colonnes requises: sku, qty, unitCost (name et comptes optionnels)");
  }

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sku = row.getCell(skuCol).value;
    if (!sku) return;
    rows.push({
      sku: String(sku).trim(),
      name: nameCol ? String(row.getCell(nameCol).value || "").trim() : "",
      qty: num(row.getCell(qtyCol).value),
      unitCost: num(row.getCell(unitCostCol).value),
      inventoryAccountNumber: invAccCol ? String(row.getCell(invAccCol).value || "").trim() : "",
      stockVariationAccountNumber: varAccCol ? String(row.getCell(varAccCol).value || "").trim() : "",
    });
  });

  if (!rows.length) throw new Error("Aucune ligne detectee");
  const duplicateSkus = rows
    .map((row) => row.sku)
    .filter((sku, idx, list) => list.indexOf(sku) !== idx);
  if (duplicateSkus.length) {
    throw new Error(
      `SKUs dupliques dans le fichier: ${[...new Set(duplicateSkus)].join(", ")}`
    );
  }

  const existingSkus = await prisma.product.findMany({
    where: { companyId, sku: { in: rows.map((row) => row.sku) } },
    select: { sku: true },
  });
  if (existingSkus.length) {
    throw new Error(`Import duplicated detected: existing product SKUs=${existingSkus.map((item) => item.sku).join(", ")}`);
  }

  const date = new Date(openingDate);
  const rowsMissingProductData = rows
    .filter(
      (row) =>
        row.qty !== 0 &&
        (!row.name ||
          !row.inventoryAccountNumber ||
          !row.stockVariationAccountNumber)
    )
    .map((row) => row.sku);
  if (rowsMissingProductData.length) {
    throw new Error(
      `Donnees produit incompletes pour SKUs=${rowsMissingProductData.join(", ")}`
    );
  }
  const requiredAccountNumbers = [
    ...new Set(
      rows.flatMap((row) => [
        row.inventoryAccountNumber,
        row.stockVariationAccountNumber,
      ])
    ),
  ].filter(Boolean);
  const existingAccounts = requiredAccountNumbers.length
    ? await prisma.account.findMany({
        where: { companyId, number: { in: requiredAccountNumbers } },
        select: { number: true },
      })
    : [];
  const existingAccountNumbers = new Set(
    existingAccounts.map((account) => account.number)
  );
  const missingAccountNumbers = requiredAccountNumbers.filter(
    (number) => !existingAccountNumbers.has(number)
  );
  if (missingAccountNumbers.length) {
    throw new Error(
      `Comptes introuvables: ${missingAccountNumbers.join(", ")}`
    );
  }

  if (dryRun) {
    // Mode dry-run : analyser sans modifier la base
    const preview = [];
    let productsToCreate = 0;
    let adjustmentsToMake = 0;
    let totalValue = 0;

    for (const line of rows) {
      if (line.qty === 0) continue;
      
      const existingProduct = await prisma.product.findFirst({ 
        where: { sku: line.sku, companyId },
        select: { id: true, name: true }
      });
      
      const willCreateProduct = !existingProduct && !!line.name && !!line.inventoryAccountNumber && !!line.stockVariationAccountNumber;
      const willAdjustStock = true; // Toujours un ajustement
      
      if (willCreateProduct) productsToCreate += 1;
      if (willAdjustStock) adjustmentsToMake += 1;
      
      const lineValue = line.unitCost * line.qty;
      totalValue += lineValue;
      
      preview.push({
        sku: line.sku,
        name: line.name,
        qty: line.qty,
        unitCost: line.unitCost,
        totalValue: Number(lineValue.toFixed(2)),
        existingProduct: !!existingProduct,
        willCreateProduct,
        willAdjustStock,
        inventoryAccountNumber: line.inventoryAccountNumber,
        stockVariationAccountNumber: line.stockVariationAccountNumber,
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: "DRY-RUN",
          companyId,
          openingDate,
          products: rows.length,
          productsToCreate,
          adjustmentsToMake,
          totalValue: Number(totalValue.toFixed(2)),
          preview: preview.slice(0, 10), // Limiter à 10 pour lisibilité
        },
        null,
        2
      )
    );
    return;
  }

  // Mode normal : exécuter les modifications
  let created = 0;
  let adjusted = 0;

  for (const line of rows) {
    if (line.qty === 0) continue;
    await prisma.$transaction(async (tx) => {
      let product = await tx.product.findFirst({ where: { sku: line.sku, companyId } });
      if (!product) {
        if (!line.name || !line.inventoryAccountNumber || !line.stockVariationAccountNumber) {
          throw new Error(
            `Produit ${line.sku} introuvable. Fournir name, inventoryAccountNumber et stockVariationAccountNumber.`
          );
        }
        const invAccId = await resolveAccountId(tx, line.inventoryAccountNumber, companyId);
        const varAccId = await resolveAccountId(tx, line.stockVariationAccountNumber, companyId);
        product = await tx.product.create({
          data: {
            companyId,
            sku: line.sku,
            name: line.name,
            inventoryAccountId: invAccId,
            stockVariationAccountId: varAccId,
          },
        });
        created += 1;
      }
      await applyAdjustMovement(tx, {
        productId: product.id,
        qty: line.qty,
        unitCost: line.unitCost,
        companyId,
      });
      await tx.stockMovement.create({
        data: {
          companyId,
          date,
          productId: product.id,
          movementType: "ADJUST",
          stage: "AVAILABLE",
          quantity: line.qty.toFixed(3),
          unitCost: line.unitCost ? Number(line.unitCost).toFixed(4) : null,
          totalCost: line.unitCost ? Number(line.unitCost * line.qty).toFixed(2) : null,
        },
      });
      adjusted += 1;
    });
  }

  console.log(`Import stock OK: produits crees=${created}, ajustements=${adjusted}`);
}

main().catch((err) => {
  console.error("Import stock error:", err.message || err);
  process.exit(1);
});
