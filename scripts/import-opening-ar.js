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

async function resolveAccountId(tx, number, label) {
  let acc = await tx.account.findFirst({ where: { number } });
  if (!acc) {
    acc = await tx.account.create({ data: { number, label: label || number } });
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

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/import-opening-ar.js --file <xlsx> [--sheet <name>] [--date YYYY-MM-DD]");
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

  const codeCol = headerMap.get("clientcode") || headerMap.get("code");
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
      clientCode: codeCol ? String(row.getCell(codeCol).value || "").trim() : "",
      name: String(name).trim(),
      email: emailCol ? String(row.getCell(emailCol).value || "").trim() : "",
      phone: phoneCol ? String(row.getCell(phoneCol).value || "").trim() : "",
      address: addressCol ? String(row.getCell(addressCol).value || "").trim() : "",
      accountNumber: String(row.getCell(accountCol).value || "").trim(),
      openingBalance: num(row.getCell(balCol).value),
    });
  });

  if (!rows.length) throw new Error("Aucune ligne detectee");
  const date = new Date(openingDate);
  let created = 0;
  let txCount = 0;

  for (const line of rows) {
    if (!line.accountNumber) throw new Error(`Compte client manquant pour ${line.name}`);
    if (line.openingBalance === 0) continue;
    await prisma.$transaction(async (tx) => {
      const accId = await resolveAccountId(tx, line.accountNumber, `Client ${line.name}`);
      const client = await tx.client.create({
        data: {
          name: line.name,
          email: line.email || null,
          phone: line.phone || null,
          address: line.address || null,
          accountId: accId,
        },
      });
      created += 1;

      const receivable = await tx.transaction.create({
        data: {
          date,
          description: `Ouverture client ${client.name}`,
          amount: line.openingBalance,
          direction: "DEBIT",
          kind: "RECEIVABLE",
          accountId: accId,
          clientId: client.id,
        },
      });
      const offsetAccId = await resolveAccountId(tx, offsetAccount, "Compte d'attente ouverture");
      const offset = await tx.transaction.create({
        data: {
          date,
          description: `Contrepartie ouverture client ${client.name}`,
          amount: line.openingBalance,
          direction: "CREDIT",
          kind: "ADJUSTMENT",
          accountId: offsetAccId,
        },
      });
      await createJournalEntry(tx, {
        sourceType: "OTHER",
        sourceId: client.id,
        date,
        transactionIds: [receivable.id, offset.id],
        description: `Ouverture client ${client.name}`,
      });
      txCount += 2;
    });
  }

  console.log(`Import AR OK: clients=${created}, transactions=${txCount}`);
}

main().catch((err) => {
  console.error("Import AR error:", err.message || err);
  process.exit(1);
});
