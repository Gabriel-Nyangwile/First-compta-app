import path from "node:path";
import prisma from "../src/lib/prisma.js";
import {
  companyScopedModels,
  dbLabel,
  delegateName,
  findSourceCompany,
  modelByName,
  safeSlug,
  timestampSlug,
  writeJson,
} from "./company-transfer-utils.mjs";

const companyId = process.env.SOURCE_COMPANY_ID;
const companyName = process.env.SOURCE_COMPANY_NAME;
const includeAudit = process.env.INCLUDE_AUDIT === "1";
const includeSecurity = process.env.INCLUDE_SECURITY === "1";

function orderByFor(modelName) {
  if (modelName === "Sequence") return { name: "asc" };
  const model = modelByName(modelName);
  if (model?.fields.some((field) => field.kind === "scalar" && field.name === "id")) return { id: "asc" };
  if (model?.fields.some((field) => field.kind === "scalar" && field.name === "createdAt")) return { createdAt: "asc" };
  return null;
}

async function main() {
  console.log(`[export] Source DB: ${dbLabel()}`);

  const company = await findSourceCompany(prisma, { companyId, companyName });
  if (!company) {
    throw new Error(
      "Aucune société source trouvée. Définis SOURCE_COMPANY_ID ou SOURCE_COMPANY_NAME si le nom ne contient pas Strategic Business.",
    );
  }

  const outputDir =
    process.env.OUTPUT_DIR ||
    path.join("backups", `company-export-${safeSlug(company.name)}-${timestampSlug()}`);
  const models = companyScopedModels({ includeAudit, includeSecurity });
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDatabase: dbLabel(),
    sourceCompany: {
      id: company.id,
      name: company.name,
    },
    includeAudit,
    includeSecurity,
    models: [],
    skippedByDefault: ["User", "CompanyMembership", "CompanyCreationRequest", "AuditLog"],
  };

  await writeJson(path.join(outputDir, "company.json"), company);

  for (const modelName of models) {
    const delegate = prisma[delegateName(modelName)];
    if (!delegate?.findMany) continue;
    const orderBy = orderByFor(modelName);
    const rows = await delegate.findMany(
      orderBy ? { where: { companyId: company.id }, orderBy } : { where: { companyId: company.id } },
    );
    manifest.models.push({
      model: modelName,
      count: rows.length,
      file: rows.length ? `${modelName}.json` : null,
    });
    if (rows.length) await writeJson(path.join(outputDir, `${modelName}.json`), rows);
  }

  await writeJson(path.join(outputDir, "manifest.json"), manifest);

  const total = manifest.models.reduce((sum, item) => sum + item.count, 0);
  console.log(`[export] Société: ${company.name} (${company.id})`);
  console.log(`[export] Lignes exportées: ${total}`);
  console.log(`[export] Dossier: ${outputDir}`);
}

main()
  .catch((error) => {
    console.error("[export] Échec:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
