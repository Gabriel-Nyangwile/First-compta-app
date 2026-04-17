#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/prisma.js";
import { deleteUnreferencedEmptyJournalsByIds } from "../src/lib/journalCleanup.js";

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
  };
  const companyId = getValue("--companyId");
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || !apply;
  const limitRaw = Number(getValue("--limit"));
  return {
    companyId,
    dryRun,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 25,
  };
}

function buildBackupPath(companyId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "backups", `empty-journals-${companyId}-${stamp}.json`);
}

async function main() {
  const { companyId, dryRun, limit } = parseArgs(process.argv);
  if (!companyId) {
    throw new Error("Usage: node scripts/cleanup-historical-empty-journals.js --companyId <id> [--dry-run|--apply]");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) throw new Error(`companyId introuvable: ${companyId}`);

  const journals = await prisma.journalEntry.findMany({
    where: {
      companyId,
      lines: { none: {} },
      depreciationLines: { none: {} },
      assetDisposals: { none: {} },
      inventoryCountLines: { none: {} },
      capitalPayments: { none: {} },
    },
    select: {
      id: true,
      number: true,
      sourceType: true,
      sourceId: true,
      description: true,
      date: true,
      createdAt: true,
    },
    orderBy: [{ number: "asc" }],
  });

  const byType = journals.reduce((acc, row) => {
    const key = row.sourceType || "OTHER";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const backupPath = buildBackupPath(companyId);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        company,
        generatedAt: new Date().toISOString(),
        journalCount: journals.length,
        byType,
        journals,
      },
      null,
      2
    )
  );

  console.log(`Cleanup historical empty journals (${dryRun ? "dry-run" : "apply"})...`);
  console.log(`- ${company.name} (${company.id})`);
  console.log(`  archivedReport: ${backupPath}`);
  console.log(`  deletableEmptyJournals: ${journals.length}`);
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
  for (const row of journals.slice(0, limit)) {
    console.log(
      `  EX ${row.number} ${row.sourceType || "OTHER"}:${row.sourceId || ""} ${row.description || ""}`.trim()
    );
  }

  if (dryRun) {
    console.log("Dry-run complete. Re-run with --apply to delete these archived empty journals.");
    return;
  }

  const result = await prisma.$transaction((tx) =>
    deleteUnreferencedEmptyJournalsByIds(
      tx,
      journals.map((item) => item.id),
      companyId
    )
  );

  console.log(`Deleted empty journals: ${result.count}`);
}

main()
  .catch((error) => {
    console.error("[cleanup-historical-empty-journals] failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
