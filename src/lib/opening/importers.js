import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { createJournalEntry } from "@/lib/journal";
import { applyAdjustMovement } from "@/lib/inventory";
import { resolveCategoryAccounts } from "@/lib/assets";
import { nextSequence } from "@/lib/sequence";

export const openingKinds = ["balance", "stock", "ar", "ap", "assets"];

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function pickHeader(headerMap, names) {
  for (const name of names) {
    const value = headerMap.get(name);
    if (value != null) return value;
  }
  return null;
}

function num(value) {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const n = Date.parse(value);
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

async function workbookFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function getWorksheet(workbook, sheetName) {
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) throw new Error("Feuille Excel introuvable.");
  return worksheet;
}

function readHeaders(worksheet) {
  const map = new Map();
  worksheet.getRow(1).values.forEach((header, idx) => {
    if (header) map.set(normalizeHeader(header), idx);
  });
  return map;
}

function requireColumns(columns, labels) {
  const missing = labels.filter((label) => columns[label] == null);
  if (missing.length) throw new Error(`Colonnes requises manquantes: ${missing.join(", ")}`);
}

async function resolveAccountId(tx, number, label, companyId, { create = false } = {}) {
  let account = await tx.account.findFirst({ where: { number, companyId } });
  if (!account && create) {
    account = await tx.account.create({
      data: { number, label: label || number, companyId },
    });
  }
  if (!account) throw new Error(`Compte introuvable: ${number}`);
  return account.id;
}

async function ensureAccountsExist(companyId, numbers) {
  const accountNumbers = [...new Set(numbers.filter(Boolean))];
  if (!accountNumbers.length) return;
  const accounts = await prisma.account.findMany({
    where: { companyId, number: { in: accountNumbers } },
    select: { number: true },
  });
  const found = new Set(accounts.map((account) => account.number));
  const missing = accountNumbers.filter((number) => !found.has(number));
  if (missing.length) throw new Error(`Comptes introuvables: ${missing.join(", ")}`);
}

function baseReport(kind, dryRun, companyId, openingDate, rows, summary, preview) {
  return {
    ok: true,
    mode: dryRun ? "DRY_RUN" : "IMPORT",
    kind,
    companyId,
    openingDate,
    rows: rows.length,
    summary,
    preview: preview.slice(0, 10),
  };
}

function readBalanceRows(worksheet) {
  const headers = readHeaders(worksheet);
  const columns = {
    accountNumber: pickHeader(headers, ["accountnumber", "account_number", "numero", "number"]),
    label: pickHeader(headers, ["accountlabel", "label", "libelle"]),
    debit: pickHeader(headers, ["debit"]),
    credit: pickHeader(headers, ["credit"]),
  };
  requireColumns(columns, ["accountNumber", "debit", "credit"]);

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const accountNumber = row.getCell(columns.accountNumber).value;
    if (!accountNumber) return;
    const debit = num(row.getCell(columns.debit).value);
    const credit = num(row.getCell(columns.credit).value);
    if (debit === 0 && credit === 0) return;
    if (debit > 0 && credit > 0) throw new Error(`Ligne ${rowNumber}: debit et credit renseignes.`);
    rows.push({
      accountNumber: String(accountNumber).trim(),
      label: columns.label ? String(row.getCell(columns.label).value || "").trim() : "",
      debit,
      credit,
    });
  });
  return rows;
}

async function importBalance({ buffer, sheetName, companyId, openingDate, dryRun }) {
  const workbook = await workbookFromBuffer(buffer);
  const rows = readBalanceRows(getWorksheet(workbook, sheetName));
  if (!rows.length) throw new Error("Aucune ligne detectee.");

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Balance non equilibree (debit=${totalDebit} credit=${totalCredit}).`);
  }

  const date = new Date(openingDate);
  const existing = await prisma.journalEntry.findFirst({
    where: { companyId, sourceType: "OTHER", description: `Ouverture ${openingDate}`, date },
    select: { number: true },
  });
  if (existing) throw new Error(`Balance d'ouverture deja importee: ${existing.number}`);
  await ensureAccountsExist(companyId, rows.map((row) => row.accountNumber));

  const report = baseReport(
    "balance",
    dryRun,
    companyId,
    openingDate,
    rows,
    {
      totalDebit: round2(totalDebit),
      totalCredit: round2(totalCredit),
      transactionsToCreate: rows.length,
    },
    rows
  );
  if (dryRun) return report;

  const result = await prisma.$transaction(async (tx) => {
    const transactionIds = [];
    for (const row of rows) {
      const accountId = await resolveAccountId(tx, row.accountNumber, row.label, companyId);
      const direction = row.debit > 0 ? "DEBIT" : "CREDIT";
      const amount = row.debit > 0 ? row.debit : row.credit;
      const transaction = await tx.transaction.create({
        data: {
          companyId,
          date,
          description: `Ouverture ${openingDate} ${row.label || ""}`.trim(),
          amount,
          direction,
          kind: "ADJUSTMENT",
          accountId,
        },
      });
      transactionIds.push(transaction.id);
    }
    const journalEntry = await createJournalEntry(tx, {
      sourceType: "OTHER",
      sourceId: null,
      date,
      transactionIds,
      description: `Ouverture ${openingDate}`,
    });
    return { transactionsCreated: transactionIds.length, journalEntry: journalEntry.number };
  });
  return { ...report, summary: { ...report.summary, ...result } };
}

function readStockRows(worksheet) {
  const headers = readHeaders(worksheet);
  const columns = {
    sku: pickHeader(headers, ["sku"]),
    name: pickHeader(headers, ["name", "designation"]),
    qty: pickHeader(headers, ["qty", "quantity"]),
    unitCost: pickHeader(headers, ["unitcost", "cost"]),
    inventoryAccountNumber: pickHeader(headers, ["inventoryaccountnumber", "inventory_account"]),
    stockVariationAccountNumber: pickHeader(headers, ["stockvariationaccountnumber", "variation_account"]),
  };
  requireColumns(columns, ["sku", "qty", "unitCost"]);
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const sku = row.getCell(columns.sku).value;
    if (!sku) return;
    rows.push({
      sku: String(sku).trim(),
      name: columns.name ? String(row.getCell(columns.name).value || "").trim() : "",
      qty: num(row.getCell(columns.qty).value),
      unitCost: num(row.getCell(columns.unitCost).value),
      inventoryAccountNumber: columns.inventoryAccountNumber ? String(row.getCell(columns.inventoryAccountNumber).value || "").trim() : "",
      stockVariationAccountNumber: columns.stockVariationAccountNumber ? String(row.getCell(columns.stockVariationAccountNumber).value || "").trim() : "",
    });
  });
  return rows;
}

async function importStock({ buffer, sheetName, companyId, openingDate, dryRun }) {
  const workbook = await workbookFromBuffer(buffer);
  const rows = readStockRows(getWorksheet(workbook, sheetName));
  if (!rows.length) throw new Error("Aucune ligne detectee.");
  const duplicateSkus = rows.map((row) => row.sku).filter((sku, idx, list) => list.indexOf(sku) !== idx);
  if (duplicateSkus.length) throw new Error(`SKUs dupliques: ${[...new Set(duplicateSkus)].join(", ")}`);

  const existingProducts = await prisma.product.findMany({
    where: { companyId, sku: { in: rows.map((row) => row.sku) } },
    select: { sku: true },
  });
  if (existingProducts.length) {
    throw new Error(`Produits deja existants: ${existingProducts.map((item) => item.sku).join(", ")}`);
  }
  const missingData = rows
    .filter((row) => row.qty !== 0 && (!row.name || !row.inventoryAccountNumber || !row.stockVariationAccountNumber))
    .map((row) => row.sku);
  if (missingData.length) throw new Error(`Donnees produit incompletes: ${missingData.join(", ")}`);
  await ensureAccountsExist(
    companyId,
    rows.flatMap((row) => [row.inventoryAccountNumber, row.stockVariationAccountNumber])
  );

  const totalValue = rows.reduce((sum, row) => sum + row.qty * row.unitCost, 0);
  const report = baseReport(
    "stock",
    dryRun,
    companyId,
    openingDate,
    rows,
    {
      productsToCreate: rows.filter((row) => row.qty !== 0).length,
      movementsToCreate: rows.filter((row) => row.qty !== 0).length,
      totalValue: round2(totalValue),
    },
    rows.map((row) => ({ ...row, totalValue: round2(row.qty * row.unitCost) }))
  );
  if (dryRun) return report;

  const date = new Date(openingDate);
  let productsCreated = 0;
  let movementsCreated = 0;
  for (const row of rows) {
    if (row.qty === 0) continue;
    await prisma.$transaction(async (tx) => {
      const inventoryAccountId = await resolveAccountId(tx, row.inventoryAccountNumber, "Compte stock", companyId);
      const stockVariationAccountId = await resolveAccountId(tx, row.stockVariationAccountNumber, "Compte variation stock", companyId);
      const product = await tx.product.create({
        data: {
          companyId,
          sku: row.sku,
          name: row.name,
          inventoryAccountId,
          stockVariationAccountId,
        },
      });
      productsCreated += 1;
      await applyAdjustMovement(tx, {
        productId: product.id,
        qty: row.qty,
        unitCost: row.unitCost,
        companyId,
      });
      await tx.stockMovement.create({
        data: {
          companyId,
          date,
          productId: product.id,
          movementType: "ADJUST",
          stage: "AVAILABLE",
          quantity: row.qty.toFixed(3),
          unitCost: row.unitCost ? Number(row.unitCost).toFixed(4) : null,
          totalCost: row.unitCost ? Number(row.unitCost * row.qty).toFixed(2) : null,
        },
      });
      movementsCreated += 1;
    });
  }
  return { ...report, summary: { ...report.summary, productsCreated, movementsCreated } };
}

function readPartyRows(worksheet, kind) {
  const headers = readHeaders(worksheet);
  const columns = {
    code: pickHeader(headers, [kind === "ar" ? "clientcode" : "suppliercode", "code"]),
    name: pickHeader(headers, ["name"]),
    email: pickHeader(headers, ["email"]),
    phone: pickHeader(headers, ["phone"]),
    address: pickHeader(headers, ["address"]),
    accountNumber: pickHeader(headers, ["accountnumber", "account_number"]),
    openingBalance: pickHeader(headers, ["openingbalance", "balance"]),
  };
  requireColumns(columns, ["name", "accountNumber", "openingBalance"]);
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = row.getCell(columns.name).value;
    if (!name) return;
    rows.push({
      code: columns.code ? String(row.getCell(columns.code).value || "").trim() : "",
      name: String(name).trim(),
      email: columns.email ? String(row.getCell(columns.email).value || "").trim() : "",
      phone: columns.phone ? String(row.getCell(columns.phone).value || "").trim() : "",
      address: columns.address ? String(row.getCell(columns.address).value || "").trim() : "",
      accountNumber: String(row.getCell(columns.accountNumber).value || "").trim(),
      openingBalance: num(row.getCell(columns.openingBalance).value),
    });
  });
  return rows;
}

async function importParty({ kind, buffer, sheetName, companyId, openingDate, dryRun }) {
  const workbook = await workbookFromBuffer(buffer);
  const rows = readPartyRows(getWorksheet(workbook, sheetName), kind);
  if (!rows.length) throw new Error("Aucune ligne detectee.");
  const model = kind === "ar" ? prisma.client : prisma.supplier;
  const accountNumbers = [...new Set(rows.map((row) => row.accountNumber).filter(Boolean))];
  const accounts = await prisma.account.findMany({
    where: { companyId, number: { in: accountNumbers } },
    select: { id: true, number: true },
  });
  const existing = accounts.length
    ? await model.findMany({
        where: { companyId, accountId: { in: accounts.map((account) => account.id) } },
        select: { account: { select: { number: true } } },
      })
    : [];
  if (existing.length) {
    throw new Error(
      `${kind === "ar" ? "Clients" : "Fournisseurs"} deja existants pour comptes: ${existing
        .map((item) => item.account.number)
        .join(", ")}`
    );
  }

  const totalBalance = rows.reduce((sum, row) => sum + row.openingBalance, 0);
  const report = baseReport(
    kind,
    dryRun,
    companyId,
    openingDate,
    rows,
    {
      partiesToCreate: rows.filter((row) => row.openingBalance !== 0).length,
      transactionsToCreate: rows.filter((row) => row.openingBalance !== 0).length * 2,
      totalBalance: round2(totalBalance),
      offsetAccount: process.env.OPENING_OFFSET_ACCOUNT || "471000",
    },
    rows
  );
  if (dryRun) return report;

  const date = new Date(openingDate);
  const offsetAccount = process.env.OPENING_OFFSET_ACCOUNT || "471000";
  let partiesCreated = 0;
  let transactionsCreated = 0;
  for (const row of rows) {
    if (!row.accountNumber) throw new Error(`Compte manquant pour ${row.name}`);
    if (row.openingBalance === 0) continue;
    await prisma.$transaction(async (tx) => {
      const accountId = await resolveAccountId(tx, row.accountNumber, row.name, companyId, { create: true });
      const party =
        kind === "ar"
          ? await tx.client.create({
              data: {
                companyId,
                name: row.name,
                email: row.email || null,
                phone: row.phone || null,
                address: row.address || null,
                accountId,
              },
            })
          : await tx.supplier.create({
              data: {
                companyId,
                name: row.name,
                email: row.email || null,
                phone: row.phone || null,
                address: row.address || null,
                accountId,
              },
            });
      partiesCreated += 1;
      const offsetAccountId = await resolveAccountId(tx, offsetAccount, "Compte d'attente ouverture", companyId, { create: true });
      const main = await tx.transaction.create({
        data: {
          companyId,
          date,
          description: `Ouverture ${kind === "ar" ? "client" : "fournisseur"} ${party.name}`,
          amount: row.openingBalance,
          direction: kind === "ar" ? "DEBIT" : "CREDIT",
          kind: kind === "ar" ? "RECEIVABLE" : "PAYABLE",
          accountId,
          ...(kind === "ar" ? { clientId: party.id } : { supplierId: party.id }),
        },
      });
      const offset = await tx.transaction.create({
        data: {
          companyId,
          date,
          description: `Contrepartie ouverture ${kind === "ar" ? "client" : "fournisseur"} ${party.name}`,
          amount: row.openingBalance,
          direction: kind === "ar" ? "CREDIT" : "DEBIT",
          kind: "ADJUSTMENT",
          accountId: offsetAccountId,
        },
      });
      await createJournalEntry(tx, {
        sourceType: "OTHER",
        sourceId: party.id,
        date,
        transactionIds: [main.id, offset.id],
        description: `Ouverture ${kind === "ar" ? "client" : "fournisseur"} ${party.name}`,
      });
      transactionsCreated += 2;
    });
  }
  return { ...report, summary: { ...report.summary, partiesCreated, transactionsCreated } };
}

function readAssetRows(worksheet) {
  const headers = readHeaders(worksheet);
  const columns = {
    assetCode: pickHeader(headers, ["assetcode", "code"]),
    name: pickHeader(headers, ["name", "label"]),
    categoryCode: pickHeader(headers, ["categorycode", "category"]),
    acquisitionDate: pickHeader(headers, ["acquisitiondate", "date"]),
    inServiceDate: pickHeader(headers, ["inservicedate"]),
    acquisitionCost: pickHeader(headers, ["acquisitioncost", "cost"]),
    accumulatedDepreciation: pickHeader(headers, ["accumulateddepreciation", "accumulated"]),
    remainingLifeMonths: pickHeader(headers, ["remaininglifemonths", "remaining"]),
    salvage: pickHeader(headers, ["salvage"]),
    netBookValue: pickHeader(headers, ["netbookvalue", "net_book_value", "vnc"]),
  };
  requireColumns(columns, ["assetCode", "name", "categoryCode", "acquisitionDate", "acquisitionCost", "remainingLifeMonths"]);
  const rows = [];
  const seenCodes = new Set();
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rawCode = row.getCell(columns.assetCode).value;
    if (!rawCode) return;
    const assetCode = String(rawCode).trim();
    if (seenCodes.has(assetCode)) throw new Error(`assetCode duplique: ${assetCode}`);
    seenCodes.add(assetCode);
    rows.push({
      assetCode,
      name: String(row.getCell(columns.name).value || "").trim(),
      categoryCode: String(row.getCell(columns.categoryCode).value || "").trim(),
      acquisitionDate: parseDate(row.getCell(columns.acquisitionDate).value),
      inServiceDate: parseDate(columns.inServiceDate ? row.getCell(columns.inServiceDate).value : null),
      acquisitionCost: num(row.getCell(columns.acquisitionCost).value),
      accumulatedDepreciation: num(columns.accumulatedDepreciation ? row.getCell(columns.accumulatedDepreciation).value : 0),
      remainingLifeMonths: Number(row.getCell(columns.remainingLifeMonths).value || 0),
      salvage: num(columns.salvage ? row.getCell(columns.salvage).value : 0),
      netBookValue: num(columns.netBookValue ? row.getCell(columns.netBookValue).value : 0),
      hasNetBookValue: columns.netBookValue != null,
    });
  });
  return rows;
}

async function importAssets({ buffer, sheetName, companyId, openingDate, dryRun }) {
  const workbook = await workbookFromBuffer(buffer);
  const rows = readAssetRows(getWorksheet(workbook, sheetName));
  if (!rows.length) throw new Error("Aucune ligne detectee.");
  const existingAssets = await prisma.asset.findMany({ where: { companyId }, select: { meta: true } });
  const existingSourceCodes = new Set(existingAssets.map((asset) => asset.meta?.sourceCode).filter((code) => typeof code === "string"));
  const duplicateSourceCodes = rows.map((row) => row.assetCode).filter((code) => existingSourceCodes.has(code));
  if (duplicateSourceCodes.length) throw new Error(`Immobilisations deja importees: ${duplicateSourceCodes.join(", ")}`);

  const categoryCodes = [...new Set(rows.map((row) => row.categoryCode))];
  const categories = await prisma.assetCategory.findMany({
    where: { companyId, code: { in: categoryCodes } },
  });
  const categoryMap = new Map(categories.map((category) => [category.code, category]));
  const missingCategories = categoryCodes.filter((code) => !categoryMap.has(code));
  if (missingCategories.length) throw new Error(`Categories introuvables: ${missingCategories.join(", ")}`);
  const incompleteCategories = categories
    .filter(
      (category) =>
        !(category.assetAccountId || category.assetAccountNumber) ||
        !(category.depreciationAccountId || category.depreciationAccountNumber) ||
        !(category.expenseAccountId || category.expenseAccountNumber)
    )
    .map((category) => category.code);
  if (incompleteCategories.length) throw new Error(`Mappings immos incomplets: ${incompleteCategories.join(", ")}`);

  const totals = { acquisitionCost: 0, accumulatedDepreciation: 0, netBookValue: 0 };
  for (const row of rows) {
    const computedNetBookValue = round2(row.acquisitionCost - row.accumulatedDepreciation);
    const netBookValue = row.hasNetBookValue ? round2(row.netBookValue) : computedNetBookValue;
    if (!row.name || !row.categoryCode || !row.acquisitionDate) throw new Error(`Ligne invalide pour ${row.assetCode}`);
    if (row.remainingLifeMonths <= 0) throw new Error(`remainingLifeMonths invalide pour ${row.assetCode}`);
    if (row.acquisitionCost <= 0) throw new Error(`acquisitionCost invalide pour ${row.assetCode}`);
    if (row.accumulatedDepreciation < 0) throw new Error(`accumulatedDepreciation invalide pour ${row.assetCode}`);
    if (row.accumulatedDepreciation - row.acquisitionCost > 0.01) throw new Error(`Amortissement > cout pour ${row.assetCode}`);
    if (row.hasNetBookValue && Math.abs(computedNetBookValue - netBookValue) > 0.01) {
      throw new Error(`netBookValue incoherente pour ${row.assetCode}`);
    }
    row.netBookValue = netBookValue;
    totals.acquisitionCost += row.acquisitionCost;
    totals.accumulatedDepreciation += row.accumulatedDepreciation;
    totals.netBookValue += row.netBookValue;
  }

  const offsetAccount = process.env.OPENING_OFFSET_ACCOUNT || "471000";
  const report = baseReport(
    "assets",
    dryRun,
    companyId,
    openingDate,
    rows,
    {
      assetsToCreate: rows.length,
      offsetAccount,
      acquisitionCost: round2(totals.acquisitionCost),
      accumulatedDepreciation: round2(totals.accumulatedDepreciation),
      netBookValue: round2(totals.netBookValue),
    },
    rows.map((row) => ({
      assetCode: row.assetCode,
      categoryCode: row.categoryCode,
      acquisitionCost: row.acquisitionCost,
      accumulatedDepreciation: row.accumulatedDepreciation,
      netBookValue: row.netBookValue,
    }))
  );
  if (dryRun) return report;

  const opening = new Date(openingDate);
  const openingPrev = prevMonth(opening);
  let assetsCreated = 0;
  let journalsCreated = 0;
  let depreciationLinesCreated = 0;

  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const category = await tx.assetCategory.findFirst({ where: { companyId, code: row.categoryCode } });
      const accounts = await resolveCategoryAccounts(category, tx);
      const offsetAccountId = await resolveAccountId(tx, offsetAccount, "Compte d'attente ouverture", companyId, { create: true });
      const ref = await nextSequence(tx, "ASSET", "AS-", companyId);
      const asset = await tx.asset.create({
        data: {
          companyId,
          ref,
          label: row.name,
          categoryId: category.id,
          acquisitionDate: row.acquisitionDate,
          inServiceDate: row.inServiceDate || row.acquisitionDate,
          cost: row.acquisitionCost,
          salvage: row.salvage || 0,
          usefulLifeMonths: category.durationMonths || row.remainingLifeMonths,
          method: category.method || "LINEAR",
          status: "ACTIVE",
          meta: {
            openingAccumulated: row.accumulatedDepreciation || 0,
            remainingLifeMonths: row.remainingLifeMonths,
            openingDate: opening.toISOString(),
            openingNetBookValue: row.netBookValue,
            sourceCode: row.assetCode,
          },
        },
      });
      assetsCreated += 1;
      const description = `Ouverture immobilisation ${asset.ref} ${row.assetCode}`;
      const transactions = [
        await tx.transaction.create({
          data: {
            companyId,
            date: opening,
            description,
            amount: row.acquisitionCost,
            direction: "DEBIT",
            kind: "ASSET_ACQUISITION",
            accountId: accounts.asset,
          },
        }),
      ];
      if (row.accumulatedDepreciation > 0) {
        transactions.push(
          await tx.transaction.create({
            data: {
              companyId,
              date: opening,
              description,
              amount: row.accumulatedDepreciation,
              direction: "CREDIT",
              kind: "ASSET_DEPRECIATION_RESERVE",
              accountId: accounts.depreciation,
            },
          })
        );
      }
      if (row.netBookValue > 0) {
        transactions.push(
          await tx.transaction.create({
            data: {
              companyId,
              date: opening,
              description,
              amount: row.netBookValue,
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
        transactionIds: transactions.map((transaction) => transaction.id),
        description,
      });
      journalsCreated += 1;
      if (row.accumulatedDepreciation > 0) {
        await tx.depreciationLine.create({
          data: {
            companyId,
            assetId: asset.id,
            year: openingPrev.year,
            month: openingPrev.month,
            amount: row.accumulatedDepreciation,
            cumulative: row.accumulatedDepreciation,
            status: "POSTED",
            journalEntryId: journal.id,
            postedAt: openingPrev.date,
          },
        });
        depreciationLinesCreated += 1;
      }
    });
  }
  return {
    ...report,
    summary: {
      ...report.summary,
      assetsCreated,
      journalsCreated,
      depreciationLinesCreated,
    },
  };
}

export async function runOpeningImport({ kind, buffer, sheetName = null, companyId, openingDate, dryRun }) {
  if (!openingKinds.includes(kind)) throw new Error(`Import inconnu: ${kind}`);
  if (!companyId) throw new Error("companyId requis.");
  if (!openingDate) throw new Error("date d'ouverture requise.");
  if (!buffer) throw new Error("Fichier Excel requis.");
  if (kind === "balance") return importBalance({ buffer, sheetName, companyId, openingDate, dryRun });
  if (kind === "stock") return importStock({ buffer, sheetName, companyId, openingDate, dryRun });
  if (kind === "ar" || kind === "ap") return importParty({ kind, buffer, sheetName, companyId, openingDate, dryRun });
  return importAssets({ buffer, sheetName, companyId, openingDate, dryRun });
}

export async function getOpeningStatus(companyId) {
  const [journals, transactions, products, clients, suppliers, assets, stockMovements] =
    await Promise.all([
      prisma.journalEntry.count({ where: { companyId, description: { startsWith: "Ouverture" } } }),
      prisma.transaction.count({ where: { companyId, description: { startsWith: "Ouverture" } } }),
      prisma.product.count({ where: { companyId } }),
      prisma.client.count({ where: { companyId } }),
      prisma.supplier.count({ where: { companyId } }),
      prisma.asset.count({ where: { companyId } }),
      prisma.stockMovement.count({ where: { companyId, movementType: "ADJUST" } }),
    ]);
  const lastOpening = await prisma.journalEntry.findFirst({
    where: { companyId, description: { startsWith: "Ouverture" } },
    orderBy: { date: "desc" },
    select: { number: true, date: true, description: true },
  });
  return {
    companyId,
    lastOpening,
    counts: {
      openingJournals: journals,
      openingTransactions: transactions,
      products,
      clients,
      suppliers,
      assets,
      stockAdjustments: stockMovements,
    },
  };
}
