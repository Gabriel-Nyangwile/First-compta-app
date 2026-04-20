import "server-only";
import prisma from "@/lib/prisma";

function normalizeCurrency(currency) {
  const normalized = String(currency || "").trim().toUpperCase();
  if (normalized) return normalized;
  const envCurrency = String(process.env.DEFAULT_COMPANY_CURRENCY || "")
    .trim()
    .toUpperCase();
  return envCurrency || "XOF";
}

export async function getCompanyCurrency(companyId) {
  if (!companyId) return normalizeCurrency();
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });
  return normalizeCurrency(company?.currency);
}
