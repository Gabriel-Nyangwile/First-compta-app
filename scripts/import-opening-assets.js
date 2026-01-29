#!/usr/bin/env node
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import prisma from "../src/lib/prisma.js";
import { nextSequence } from "../src/lib/sequence.js";

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

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const n = Date.parse(v);
  return Number.isNaN(n) ? null : new Date(n);
}

function prevMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return { year, month, date: new Date(year, month - 1, 1) };
}

async function main() {
  const file = argValue("--file");
  const sheetName = argValue("--sheet");
  const openingDate =
    argValue("--date") || process.env.OPENING_DATE || "2026-01-01";

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/import-opening-assets.js --file <xlsx> [--sheet <name>] [--date YYYY-MM-DD]");
    process.exit(1);
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

  const codeCol = headerMap.get("assetcode") || headerMap.get("code");
  const nameCol = headerMap.get("name") || headerMap.get("label");
  const categoryCol =
    headerMap.get("categorycode") || headerMap.get("category");
  const acqDateCol =
    headerMap.get("acquisitiondate") || headerMap.get("date");
  const inServiceCol = headerMap.get("inservicedate");
  const costCol =
    headerMap.get("acquisitioncost") || headerMap.get("cost");
  const accumCol =
    headerMap.get("accumulateddepreciation") || headerMap.get("accumulated");
  const remainingCol =
    headerMap.get("remaininglifemonths") || headerMap.get("remaining");
  const salvageCol = headerMap.get("salvage");

  if (!codeCol || !nameCol || !categoryCol || !acqDateCol || !costCol || !remainingCol) {
    throw new Error("Colonnes requises: assetCode, name, categoryCode, acquisitionDate, acquisitionCost, remainingLifeMonths");
  }

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = row.getCell(codeCol).value;
    if (!code) return;
    rows.push({
      assetCode: String(code).trim(),
      name: String(row.getCell(nameCol).value || "").trim(),
      categoryCode: String(row.getCell(categoryCol).value || "").trim(),
      acquisitionDate: parseDate(row.getCell(acqDateCol).value),
      inServiceDate: parseDate(inServiceCol ? row.getCell(inServiceCol).value : null),
      acquisitionCost: num(row.getCell(costCol).value),
      accumulatedDepreciation: num(accumCol ? row.getCell(accumCol).value : 0),
      remainingLifeMonths: Number(row.getCell(remainingCol).value || 0),
      salvage: num(salvageCol ? row.getCell(salvageCol).value : 0),
    });
  });

  if (!rows.length) throw new Error("Aucune ligne detectee");
  const opening = new Date(openingDate);
  const openingPrev = prevMonth(opening);
  let created = 0;
  let depLines = 0;

  for (const line of rows) {
    if (!line.name || !line.categoryCode || !line.acquisitionDate) {
      throw new Error(`Ligne invalide pour asset ${line.assetCode}`);
    }
    if (line.remainingLifeMonths <= 0) {
      throw new Error(`remainingLifeMonths invalide pour ${line.assetCode}`);
    }
    await prisma.$transaction(async (tx) => {
      const category = await tx.assetCategory.findUnique({
        where: { code: line.categoryCode },
      });
      if (!category) throw new Error(`Categorie introuvable: ${line.categoryCode}`);
      const ref = await nextSequence(tx, "ASSET", "AS-");
      const asset = await tx.asset.create({
        data: {
          ref,
          label: line.name,
          categoryId: category.id,
          acquisitionDate: line.acquisitionDate,
          inServiceDate: line.inServiceDate || line.acquisitionDate,
          cost: line.acquisitionCost,
          salvage: line.salvage || 0,
          usefulLifeMonths: line.remainingLifeMonths,
          method: category.method || "LINEAR",
          status: "ACTIVE",
          meta: {
            openingAccumulated: line.accumulatedDepreciation || 0,
            remainingLifeMonths: line.remainingLifeMonths,
            openingDate,
            sourceCode: line.assetCode,
          },
        },
      });
      created += 1;
      if (line.accumulatedDepreciation > 0) {
        await tx.depreciationLine.create({
          data: {
            assetId: asset.id,
            year: openingPrev.year,
            month: openingPrev.month,
            amount: line.accumulatedDepreciation,
            cumulative: line.accumulatedDepreciation,
            status: "POSTED",
            postedAt: openingPrev.date,
          },
        });
        depLines += 1;
      }
    });
  }

  console.log(`Import assets OK: assets=${created}, openingDepLines=${depLines}`);
}

main().catch((err) => {
  console.error("Import assets error:", err.message || err);
  process.exit(1);
});
