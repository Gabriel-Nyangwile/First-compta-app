import { existsSync } from "node:fs";
import path from "node:path";
import prisma from "../src/lib/prisma.js";
import {
  delegateName,
  modelByName,
  readJson,
  sortModels,
  writeJson,
} from "./company-transfer-utils.mjs";

const backupDir = process.env.BACKUP_DIR || process.argv[2];

async function fileRows(modelName) {
  const filePath = path.join(backupDir, `${modelName}.json`);
  if (!existsSync(filePath)) return [];
  return readJson(filePath);
}

function accountRelations(modelName) {
  const model = modelByName(modelName);
  return (model?.fields || [])
    .filter((field) => field.kind === "object" && field.type === "Account" && field.relationFromFields?.length)
    .flatMap((field) => field.relationFromFields);
}

async function main() {
  if (!backupDir) throw new Error("BACKUP_DIR est requis.");
  const manifestPath = path.join(backupDir, "manifest.json");
  const accountPath = path.join(backupDir, "Account.json");
  if (!existsSync(manifestPath) || !existsSync(accountPath)) {
    throw new Error(`Dossier d'export invalide: ${backupDir}`);
  }

  const manifest = await readJson(manifestPath);
  const accounts = await readJson(accountPath);
  const sourceCompanyId = manifest.sourceCompany.id;
  const accountIds = new Set(accounts.map((account) => account.id));
  const accountByNumber = new Map(accounts.map((account) => [account.number, account]));
  const accountIdRemap = new Map();
  const appendedAccounts = [];
  const touchedModels = [];

  const models = sortModels(manifest.models.filter((item) => item.count > 0 && item.file).map((item) => item.model));
  for (const modelName of models) {
    const fields = accountRelations(modelName);
    if (!fields.length) continue;

    const rows = await fileRows(modelName);
    let changed = false;
    for (const row of rows) {
      for (const field of fields) {
        const accountId = row[field];
        if (!accountId || accountIds.has(accountId)) continue;

        if (!accountIdRemap.has(accountId)) {
          const sourceAccount = await prisma.account.findUnique({ where: { id: accountId } });
          if (!sourceAccount) {
            throw new Error(`${modelName}.${field} référence un compte introuvable: ${accountId}`);
          }
          const sameNumber = accountByNumber.get(sourceAccount.number);
          if (sameNumber) {
            accountIdRemap.set(accountId, sameNumber.id);
          } else {
            const appended = { ...sourceAccount, companyId: sourceCompanyId };
            accounts.push(appended);
            accountIds.add(appended.id);
            accountByNumber.set(appended.number, appended);
            accountIdRemap.set(accountId, appended.id);
            appendedAccounts.push({
              id: appended.id,
              number: appended.number,
              label: appended.label,
              originalCompanyId: sourceAccount.companyId,
            });
          }
        }

        row[field] = accountIdRemap.get(accountId);
        changed = true;
      }
    }

    if (changed) {
      await writeJson(path.join(backupDir, `${modelName}.json`), rows);
      touchedModels.push(modelName);
    }
  }

  const accountManifest = manifest.models.find((item) => item.model === "Account");
  if (accountManifest) accountManifest.count = accounts.length;
  await writeJson(accountPath, accounts);
  await writeJson(manifestPath, {
    ...manifest,
    repairedAt: new Date().toISOString(),
    repairNotes: [
      ...(manifest.repairNotes || []),
      {
        kind: "account-references",
        remappedReferences: accountIdRemap.size,
        appendedAccounts,
        touchedModels,
      },
    ],
  });

  console.log(`[repair] Dossier: ${backupDir}`);
  console.log(`[repair] Références comptes remappées: ${accountIdRemap.size}`);
  console.log(`[repair] Comptes ajoutés: ${appendedAccounts.length}`);
  if (touchedModels.length) console.log(`[repair] Modèles corrigés: ${touchedModels.join(", ")}`);
}

main()
  .catch((error) => {
    console.error("[repair] Échec:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
