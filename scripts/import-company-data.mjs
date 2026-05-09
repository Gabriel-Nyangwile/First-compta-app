import { existsSync } from "node:fs";
import path from "node:path";
import prisma from "../src/lib/prisma.js";
import {
  dbLabel,
  delegateName,
  findSourceCompany,
  importInBatches,
  readJson,
  reviveRow,
  sortModels,
} from "./company-transfer-utils.mjs";

const backupDir = process.env.BACKUP_DIR || process.argv[2];
const apply = process.env.APPLY === "1";
const allowNonEmptyTarget = process.env.ALLOW_NON_EMPTY_TARGET === "1";
const preserveUserRefs = process.env.PRESERVE_USER_REFS === "1";
const targetCompanyId = process.env.TARGET_COMPANY_ID;
const targetCompanyName = process.env.TARGET_COMPANY_NAME;

async function loadRows(modelName) {
  const filePath = path.join(backupDir, `${modelName}.json`);
  if (!existsSync(filePath)) return [];
  return readJson(filePath);
}

async function resolveTargetCompany(sourceCompany) {
  if (targetCompanyId || targetCompanyName) {
    const target = await findSourceCompany(prisma, {
      companyId: targetCompanyId,
      companyName: targetCompanyName,
    });
    if (!target) throw new Error("La société cible TARGET_COMPANY_ID/TARGET_COMPANY_NAME est introuvable.");
    return { company: target, created: false, mode: "remap" };
  }

  const existing = await prisma.company.findUnique({ where: { id: sourceCompany.id } });
  if (existing) return { company: existing, created: false, mode: "restore" };

  if (!apply) return { company: sourceCompany, created: false, mode: "restore" };

  const restored = await prisma.company.create({ data: reviveRow("Company", sourceCompany) });
  return { company: restored, created: true, mode: "restore" };
}

async function main() {
  if (!backupDir) {
    throw new Error("BACKUP_DIR est requis. Exemple: BACKUP_DIR=backups/company-export-... node scripts/import-company-data.mjs");
  }
  if (!existsSync(path.join(backupDir, "manifest.json")) || !existsSync(path.join(backupDir, "company.json"))) {
    throw new Error(`Dossier d'export invalide: ${backupDir}`);
  }

  console.log(`[import] Target DB: ${dbLabel()}`);
  console.log(`[import] Dossier: ${backupDir}`);

  const manifest = await readJson(path.join(backupDir, "manifest.json"));
  const sourceCompany = await readJson(path.join(backupDir, "company.json"));
  const target = await resolveTargetCompany(sourceCompany);
  const models = sortModels(manifest.models.filter((item) => item.count > 0 && item.file).map((item) => item.model));
  const targetCompanyIdForRows = target.company.id;

  const existingCounts = [];
  for (const modelName of models) {
    const delegate = prisma[delegateName(modelName)];
    if (!delegate?.count) continue;
    const count = await delegate.count({ where: { companyId: targetCompanyIdForRows } });
    if (count > 0) existingCounts.push({ model: modelName, count });
  }

  console.log(`[import] Société source: ${manifest.sourceCompany.name} (${manifest.sourceCompany.id})`);
  console.log(`[import] Mode: ${target.mode}`);
  console.log(`[import] Société cible: ${target.company.name} (${target.company.id})`);
  console.log(`[import] APPLY=${apply ? "1" : "0"} (${apply ? "écriture activée" : "simulation seulement"})`);
  if (!preserveUserRefs) console.log("[import] Les références optionnelles vers User seront remises à null.");

  if (existingCounts.length && !allowNonEmptyTarget) {
    console.table(existingCounts);
    throw new Error(
      "La société cible contient déjà des données. Relance avec ALLOW_NON_EMPTY_TARGET=1 seulement après vérification.",
    );
  }

  if (!apply) {
    console.table(manifest.models.filter((item) => item.count > 0).map(({ model, count }) => ({ model, count })));
    console.log("[import] Simulation terminée. Aucune donnée n'a été écrite.");
    return;
  }

  if (target.created) console.log("[import] Société restaurée dans la base cible.");

  const imported = [];
  for (const modelName of models) {
    const delegate = prisma[delegateName(modelName)];
    if (!delegate?.createMany) continue;
    const rows = await loadRows(modelName);
    if (!rows.length) continue;
    const data = rows.map((row) =>
      reviveRow(modelName, row, {
        companyId: targetCompanyIdForRows,
        preserveUserRefs,
      }),
    );
    const count = await importInBatches(delegate, data);
    imported.push({ model: modelName, requested: rows.length, inserted: count });
    console.log(`[import] ${modelName}: ${count}/${rows.length}`);
  }

  console.table(imported);
  console.log("[import] Import terminé.");
}

main()
  .catch((error) => {
    console.error("[import] Échec:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
