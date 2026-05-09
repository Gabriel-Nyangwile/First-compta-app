import path from "node:path";
import prisma from "../src/lib/prisma.js";
import {
  companyScopedModels,
  dbLabel,
  delegateName,
  findSourceCompany,
  safeSlug,
  timestampSlug,
  writeJson,
} from "./company-transfer-utils.mjs";

const companyId = process.env.SOURCE_COMPANY_ID;
const companyName = process.env.SOURCE_COMPANY_NAME;
const includeAudit = process.env.INCLUDE_AUDIT === "1";
const includeSecurity = process.env.INCLUDE_SECURITY === "1";

async function main() {
  console.log(`[inventory] Source DB: ${dbLabel()}`);

  const company = await findSourceCompany(prisma, { companyId, companyName });
  if (!company) {
    throw new Error(
      "Aucune société source trouvée. Définis SOURCE_COMPANY_ID ou SOURCE_COMPANY_NAME si le nom ne contient pas Strategic Business.",
    );
  }

  const models = companyScopedModels({ includeAudit, includeSecurity });
  const counts = [];
  let total = 0;

  for (const modelName of models) {
    const delegate = prisma[delegateName(modelName)];
    if (!delegate?.count) continue;
    const count = await delegate.count({ where: { companyId: company.id } });
    if (count > 0) {
      counts.push({ model: modelName, count });
      total += count;
    }
  }

  const keyModels = [
    "Account",
    "Client",
    "Supplier",
    "Product",
    "Invoice",
    "IncomingInvoice",
    "PurchaseOrder",
    "GoodsReceipt",
    "Transaction",
    "JournalEntry",
    "MoneyMovement",
    "Employee",
    "PayrollPeriod",
    "Payslip",
  ];
  const samples = {};
  for (const modelName of keyModels) {
    const delegate = prisma[delegateName(modelName)];
    if (!delegate?.findMany) continue;
    samples[modelName] = await delegate.findMany({
      where: { companyId: company.id },
      take: 5,
      orderBy: { id: "asc" },
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    database: dbLabel(),
    company,
    total,
    counts,
    samples,
    skippedByDefault: ["User", "CompanyMembership", "CompanyCreationRequest", "AuditLog"],
  };

  const outputPath = path.join(
    "backups",
    `company-inventory-${safeSlug(company.name)}-${timestampSlug()}.json`,
  );
  await writeJson(outputPath, report);

  console.log(`[inventory] Société: ${company.name} (${company.id})`);
  console.table(counts);
  console.log(`[inventory] Total lignes société: ${total}`);
  console.log(`[inventory] Rapport: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error("[inventory] Échec:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
