#!/usr/bin/env node
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import prisma from "../src/lib/prisma.js";
import { createJournalEntry } from "../src/lib/journal.js";
import { resolveCategoryAccounts } from "../src/lib/assets.js";
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

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function getExistingAssetSourceCodes(companyId) {
  const assets = await prisma.asset.findMany({
    where: { companyId },
    select: { meta: true },
  });
  return new Set(
    assets
      .map((asset) => asset.meta?.sourceCode)
      .filter((code) => typeof code === "string")
  );
}

async function resolveAccountId(tx, number, label, companyId) {
  let account = await tx.account.findFirst({ where: { number, companyId } });
  if (!account) {
    account = await tx.account.create({
      data: { companyId, number, label: label || number },
    });
  }
  return account.id;
}

async function main() {
  const file = argValue("--file");
  const sheetName = argValue("--sheet");
  const dryRun = process.argv.includes("--dry-run");
  const openingDate =
    argValue("--date") || process.env.OPENING_DATE || "2026-01-01";
  const offsetAccount = process.env.OPENING_OFFSET_ACCOUNT || "471000";
  const companyId =
    argValue("--company") || process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID;

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/import-opening-assets.js --file <xlsx> [--sheet <name>] [--date YYYY-MM-DD] [--dry-run]");
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
  const netBookCol =
    headerMap.get("netbookvalue") || headerMap.get("net_book_value") || headerMap.get("vnc");

  if (!codeCol || !nameCol || !categoryCol || !acqDateCol || !costCol || !remainingCol) {
    throw new Error("Colonnes requises: assetCode, name, categoryCode, acquisitionDate, acquisitionCost, remainingLifeMonths");
  }

  const rows = [];
  const seenCodes = new Set();
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = row.getCell(codeCol).value;
    if (!code) return;
    const assetCode = String(code).trim();
    if (seenCodes.has(assetCode)) {
      throw new Error(`assetCode dupliqué dans le fichier: ${assetCode}`);
    }
    seenCodes.add(assetCode);
    rows.push({
      assetCode,
      name: String(row.getCell(nameCol).value || "").trim(),
      categoryCode: String(row.getCell(categoryCol).value || "").trim(),
      acquisitionDate: parseDate(row.getCell(acqDateCol).value),
      inServiceDate: parseDate(inServiceCol ? row.getCell(inServiceCol).value : null),
      acquisitionCost: num(row.getCell(costCol).value),
      accumulatedDepreciation: num(accumCol ? row.getCell(accumCol).value : 0),
      remainingLifeMonths: Number(row.getCell(remainingCol).value || 0),
      salvage: num(salvageCol ? row.getCell(salvageCol).value : 0),
      netBookValue: num(netBookCol ? row.getCell(netBookCol).value : 0),
    });
  });

  if (!rows.length) throw new Error("Aucune ligne detectee");

  const existingSourceCodes = await getExistingAssetSourceCodes(companyId);
  const duplicateSourceCodes = rows
    .map((line) => line.assetCode)
    .filter((code) => existingSourceCodes.has(code));
  if (duplicateSourceCodes.length) {
    throw new Error(
      `Import duplicated detected: existing asset sourceCodes=${duplicateSourceCodes.join(", ")}`
    );
  }

  const opening = new Date(openingDate);
  const openingPrev = prevMonth(opening);
  const totals = {
    acquisitionCost: 0,
    accumulatedDepreciation: 0,
    netBookValue: 0,
  };
  let created = 0;
  let depLines = 0;
  let journals = 0;

  for (const line of rows) {
    const computedNetBookValue = round2(line.acquisitionCost - line.accumulatedDepreciation);
    const providedNetBookValue = round2(line.netBookValue || 0);
    const finalNetBookValue = netBookCol ? providedNetBookValue : computedNetBookValue;
    if (!line.name || !line.categoryCode || !line.acquisitionDate) {
      throw new Error(`Ligne invalide pour asset ${line.assetCode}`);
    }
    if (line.remainingLifeMonths <= 0) {
      throw new Error(`remainingLifeMonths invalide pour ${line.assetCode}`);
    }
    if (line.acquisitionCost <= 0) {
      throw new Error(`acquisitionCost invalide pour ${line.assetCode}`);
    }
    if (line.accumulatedDepreciation < 0) {
      throw new Error(`accumulatedDepreciation invalide pour ${line.assetCode}`);
    }
    if (line.salvage < 0) {
      throw new Error(`salvage invalide pour ${line.assetCode}`);
    }
    if (line.accumulatedDepreciation - line.acquisitionCost > 0.01) {
      throw new Error(`accumulatedDepreciation > acquisitionCost pour ${line.assetCode}`);
    }
    if (finalNetBookValue < -0.01) {
      throw new Error(`netBookValue négative pour ${line.assetCode}`);
    }
    if (netBookCol && Math.abs(computedNetBookValue - finalNetBookValue) > 0.01) {
      throw new Error(`netBookValue incohérente pour ${line.assetCode} (attendu ${computedNetBookValue.toFixed(2)}, reçu ${finalNetBookValue.toFixed(2)})`);
    }

    line.netBookValue = finalNetBookValue;
    totals.acquisitionCost += round2(line.acquisitionCost);
    totals.accumulatedDepreciation += round2(line.accumulatedDepreciation);
    totals.netBookValue += round2(line.netBookValue);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "DRY-RUN",
          companyId,
          openingDate,
          offsetAccount,
          assets: rows.length,
          totals: {
            acquisitionCost: round2(totals.acquisitionCost),
            accumulatedDepreciation: round2(totals.accumulatedDepreciation),
            netBookValue: round2(totals.netBookValue),
          },
          preview: rows.slice(0, 10).map((line) => ({
            assetCode: line.assetCode,
            categoryCode: line.categoryCode,
            acquisitionCost: round2(line.acquisitionCost),
            accumulatedDepreciation: round2(line.accumulatedDepreciation),
            netBookValue: round2(line.netBookValue),
            remainingLifeMonths: line.remainingLifeMonths,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  for (const line of rows) {
    await prisma.$transaction(async (tx) => {
      const category = await tx.assetCategory.findFirst({
        where: { code: line.categoryCode, companyId },
      });
      if (!category) throw new Error(`Categorie introuvable: ${line.categoryCode}`);
      const accounts = await resolveCategoryAccounts(category, tx);
      const offsetAccountId = await resolveAccountId(tx, offsetAccount, "Compte d'attente ouverture", companyId);
      const ref = await nextSequence(tx, "ASSET", "AS-", companyId);
      const asset = await tx.asset.create({
        data: {
          companyId,
          ref,
          label: line.name,
          categoryId: category.id,
          acquisitionDate: line.acquisitionDate,
          inServiceDate: line.inServiceDate || line.acquisitionDate,
          cost: line.acquisitionCost,
          salvage: line.salvage || 0,
          usefulLifeMonths: category.durationMonths || line.remainingLifeMonths,
          method: category.method || "LINEAR",
          status: "ACTIVE",
          meta: {
            openingAccumulated: line.accumulatedDepreciation || 0,
            remainingLifeMonths: line.remainingLifeMonths,
            openingDate: opening.toISOString(),
            openingNetBookValue: line.netBookValue,
            sourceCode: line.assetCode,
          },
        },
      });
      created += 1;
      const description = `Ouverture immobilisation ${asset.ref} ${line.assetCode}`;
      const txns = [];
      txns.push(
        await tx.transaction.create({
          data: {
            companyId,
            date: opening,
            description,
            amount: line.acquisitionCost,
            direction: "DEBIT",
            kind: "ASSET_ACQUISITION",
            accountId: accounts.asset,
          },
        })
      );
      if (line.accumulatedDepreciation > 0) {
        txns.push(
          await tx.transaction.create({
            data: {
              companyId,
              date: opening,
              description,
              amount: line.accumulatedDepreciation,
              direction: "CREDIT",
              kind: "ASSET_DEPRECIATION_RESERVE",
              accountId: accounts.depreciation,
            },
          })
        );
      }
      if (line.netBookValue > 0) {
        txns.push(
          await tx.transaction.create({
            data: {
              companyId,
              date: opening,
              description,
              amount: line.netBookValue,
              direction: "CREDIT",
              kind: "ADJUSTMENT",
              accountId: offsetAccountId,
            },
          })
        );
      }
      const journal = await createJournalEntry(tx, {
        sourceType: "ASSET",
        sourceId: asset.id,
        date: opening,
        transactionIds: txns.map((item) => item.id),
        description,
      });
      journals += 1;
      if (line.accumulatedDepreciation > 0) {
        await tx.depreciationLine.create({
          data: {
            companyId,
            assetId: asset.id,
            year: openingPrev.year,
            month: openingPrev.month,
            amount: line.accumulatedDepreciation,
            cumulative: line.accumulatedDepreciation,
            status: "POSTED",
            journalEntryId: journal.id,
            postedAt: openingPrev.date,
          },
        });
        depLines += 1;
      }
    });
  }

  console.log(
    `Import assets OK: assets=${created}, journals=${journals}, openingDepLines=${depLines}, totalCost=${round2(
      totals.acquisitionCost
    ).toFixed(2)}, totalAccum=${round2(totals.accumulatedDepreciation).toFixed(2)}, totalNBV=${round2(
      totals.netBookValue
    ).toFixed(2)}`
  );
}

main().catch((err) => {
  console.error("Import assets error:", err.message || err);
  process.exit(1);
});
