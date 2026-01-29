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

async function main() {
  const file = argValue("--file");
  const sheetName = argValue("--sheet");
  const openingDate =
    argValue("--date") || process.env.OPENING_DATE || "2026-01-01";

  if (!file) {
    console.error("Usage: node --env-file=.env.local scripts/import-opening-balance.js --file <xlsx> [--sheet <name>] [--date YYYY-MM-DD]");
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

  const accountCol =
    headerMap.get("accountnumber") ||
    headerMap.get("account_number") ||
    headerMap.get("numero") ||
    headerMap.get("number");
  const labelCol =
    headerMap.get("accountlabel") ||
    headerMap.get("label") ||
    headerMap.get("libelle");
  const debitCol = headerMap.get("debit");
  const creditCol = headerMap.get("credit");

  if (!accountCol || debitCol == null || creditCol == null) {
    throw new Error("Colonnes requises: accountNumber, debit, credit (label optionnel)");
  }

  const lines = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const accountNumber = row.getCell(accountCol).value;
    const label = labelCol ? row.getCell(labelCol).value : null;
    const debit = num(row.getCell(debitCol).value);
    const credit = num(row.getCell(creditCol).value);
    if (!accountNumber) return;
    if (debit > 0 && credit > 0) {
      throw new Error(`Ligne ${rowNumber}: debit et credit tous deux renseignes`);
    }
    if (debit === 0 && credit === 0) return;
    lines.push({
      accountNumber: String(accountNumber).trim(),
      label: label ? String(label).trim() : "",
      debit,
      credit,
    });
  });

  if (!lines.length) throw new Error("Aucune ligne detectee");

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Balance non equilibree (debit=${totalDebit} credit=${totalCredit})`);
  }

  const date = new Date(openingDate);
  const created = await prisma.$transaction(async (tx) => {
    const txns = [];
    for (const line of lines) {
      const account = await tx.account.findFirst({
        where: { number: line.accountNumber },
      });
      if (!account) throw new Error(`Compte introuvable: ${line.accountNumber}`);
      if (line.debit > 0) {
        const t = await tx.transaction.create({
          data: {
            date,
            description: `Ouverture ${openingDate} ${line.label || ""}`.trim(),
            amount: line.debit,
            direction: "DEBIT",
            kind: "ADJUSTMENT",
            accountId: account.id,
          },
        });
        txns.push(t.id);
      } else if (line.credit > 0) {
        const t = await tx.transaction.create({
          data: {
            date,
            description: `Ouverture ${openingDate} ${line.label || ""}`.trim(),
            amount: line.credit,
            direction: "CREDIT",
            kind: "ADJUSTMENT",
            accountId: account.id,
          },
        });
        txns.push(t.id);
      }
    }
    const je = await createJournalEntry(tx, {
      sourceType: "OTHER",
      sourceId: null,
      date,
      transactionIds: txns,
      description: `Ouverture ${openingDate}`,
    });
    return { count: txns.length, journalEntry: je.number };
  });

  console.log(
    `Import balance OK: ${created.count} transactions, JE=${created.journalEntry}`
  );
}

main().catch((err) => {
  console.error("Import balance error:", err.message || err);
  process.exit(1);
});
