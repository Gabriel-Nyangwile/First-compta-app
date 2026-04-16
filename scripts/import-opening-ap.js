#!/usr/bin/env node
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import prisma from "../src/lib/prisma.js";
import { createJournalEntry } from "../src/lib/journal.js";

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

async function resolveAccountId(tx, number, label, companyId) {
  let acc = await tx.account.findFirst({ where: { number, companyId } });
  if (!acc) {
    acc = await tx.account.create({
      data: { number, label: label || number, companyId },
    });
  }
  return acc.id;
}

async function main() {
  const file = argValue("--file");
  const sheetName = argValue("--sheet");
  const openingDate =
    argValue("--date") || process.env.OPENING_DATE || "2026-01-01";
  const offsetAccount =
    process.env.OPENING_OFFSET_ACCOUNT || "471000";
  const companyId =
    argValue("--company") || process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID;
  const dryRun = process.argv.includes("--dry-run");

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/import-opening-ap.js --file <xlsx> [--sheet <name>] [--date YYYY-MM-DD] [--dry-run]");
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

  const codeCol = headerMap.get("suppliercode") || headerMap.get("code");
  const nameCol = headerMap.get("name");
  const emailCol = headerMap.get("email");
  const phoneCol = headerMap.get("phone");
  const addressCol = headerMap.get("address");
  const accountCol = headerMap.get("accountnumber") || headerMap.get("account_number");
  const balCol = headerMap.get("openingbalance") || headerMap.get("balance");

  if (!nameCol || !accountCol || balCol == null) {
    throw new Error("Colonnes requises: name, accountNumber, openingBalance");
  }

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = row.getCell(nameCol).value;
    if (!name) return;
    rows.push({
      supplierCode: codeCol ? String(row.getCell(codeCol).value || "").trim() : "",
      name: String(name).trim(),
      email: emailCol ? String(row.getCell(emailCol).value || "").trim() : "",
      phone: phoneCol ? String(row.getCell(phoneCol).value || "").trim() : "",
      address: addressCol ? String(row.getCell(addressCol).value || "").trim() : "",
      accountNumber: String(row.getCell(accountCol).value || "").trim(),
      openingBalance: num(row.getCell(balCol).value),
    });
  });

  if (!rows.length) throw new Error("Aucune ligne detectee");

  const accountNumbers = [...new Set(rows.map((row) => row.accountNumber))].filter(Boolean);
  if (accountNumbers.length) {
    const accounts = await prisma.account.findMany({
      where: { companyId, number: { in: accountNumbers } },
      select: { id: true, number: true },
    });
    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length) {
      const existingSuppliers = await prisma.supplier.findMany({
        where: { companyId, accountId: { in: accountIds } },
        select: { account: { select: { number: true } } },
      });
      if (existingSuppliers.length) {
        throw new Error(
          `Import duplicated detected: existing suppliers found for accountNumbers=${existingSuppliers
            .map((supplier) => supplier.account.number)
            .join(", ")}`
        );
      }
    }
  }

  const date = new Date(openingDate);

  if (dryRun) {
    // Mode dry-run : analyser sans modifier la base
    const preview = [];
    let suppliersToCreate = 0;
    let transactionsToCreate = 0;
    let totalBalance = 0;

    for (const line of rows) {
      if (!line.accountNumber) throw new Error(`Compte fournisseur manquant pour ${line.name}`);
      if (line.openingBalance === 0) continue;
      
      suppliersToCreate += 1;
      transactionsToCreate += 2; // Une crédit + une débit
      totalBalance += line.openingBalance;
      
      preview.push({
        supplierCode: line.supplierCode,
        name: line.name,
        accountNumber: line.accountNumber,
        openingBalance: line.openingBalance,
        email: line.email,
        phone: line.phone,
        address: line.address,
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: "DRY-RUN",
          companyId,
          openingDate,
          offsetAccount,
          suppliers: rows.length,
          suppliersToCreate,
          transactionsToCreate,
          totalBalance: Number(totalBalance.toFixed(2)),
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
  let txCount = 0;

  for (const line of rows) {
    if (!line.accountNumber) throw new Error(`Compte fournisseur manquant pour ${line.name}`);
    if (line.openingBalance === 0) continue;
    await prisma.$transaction(async (tx) => {
      const accId = await resolveAccountId(tx, line.accountNumber, `Fournisseur ${line.name}`, companyId);
      const supplier = await tx.supplier.create({
        data: {
          companyId,
          name: line.name,
          email: line.email || null,
          phone: line.phone || null,
          address: line.address || null,
          accountId: accId,
        },
      });
      created += 1;

      const payable = await tx.transaction.create({
        data: {
          companyId,
          date,
          description: `Ouverture fournisseur ${supplier.name}`,
          amount: line.openingBalance,
          direction: "CREDIT",
          kind: "PAYABLE",
          accountId: accId,
          supplierId: supplier.id,
        },
      });
      const offsetAccId = await resolveAccountId(tx, offsetAccount, "Compte d'attente ouverture", companyId);
      const offset = await tx.transaction.create({
        data: {
          companyId,
          date,
          description: `Contrepartie ouverture fournisseur ${supplier.name}`,
          amount: line.openingBalance,
          direction: "DEBIT",
          kind: "ADJUSTMENT",
          accountId: offsetAccId,
        },
      });
      await createJournalEntry(tx, {
        sourceType: "OTHER",
        sourceId: supplier.id,
        date,
        transactionIds: [payable.id, offset.id],
        description: `Ouverture fournisseur ${supplier.name}`,
      });
      txCount += 2;
    });
  }

  console.log(`Import AP OK: fournisseurs=${created}, transactions=${txCount}`);
}

main().catch((err) => {
  console.error("Import AP error:", err.message || err);
  process.exit(1);
});
