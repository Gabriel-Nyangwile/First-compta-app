import prisma from "../src/lib/prisma.js";
import { dbLabel } from "./company-transfer-utils.mjs";

const companyId = process.env.COMPANY_ID;
const newName = process.env.NEW_COMPANY_NAME;
const apply = process.env.APPLY === "1";

async function main() {
  if (!companyId || !newName) {
    throw new Error("COMPANY_ID et NEW_COMPANY_NAME sont requis.");
  }

  console.log(`[rename-company] DB: ${dbLabel()}`);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, createdAt: true },
  });
  if (!company) throw new Error(`Société introuvable: ${companyId}`);

  console.log(`[rename-company] Actuel: ${company.name} (${company.id})`);
  console.log(`[rename-company] Nouveau: ${newName}`);
  console.log(`[rename-company] APPLY=${apply ? "1" : "0"} (${apply ? "écriture activée" : "simulation seulement"})`);

  if (!apply) return;

  await prisma.company.update({
    where: { id: companyId },
    data: { name: newName },
  });
  console.log("[rename-company] Société renommée.");
}

main()
  .catch((error) => {
    console.error("[rename-company] Échec:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
