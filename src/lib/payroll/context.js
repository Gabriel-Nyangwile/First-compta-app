import "server-only";

import { getCompanyCurrency } from "@/lib/companyContext";

function normalizeCurrency(currency, fallback = "XOF") {
  const normalized = String(currency || "").trim().toUpperCase();
  return normalized || fallback;
}

export async function getPayrollCurrencyContext(companyId) {
  const processingCurrency = normalizeCurrency(await getCompanyCurrency(companyId));
  return {
    companyId: companyId || null,
    processingCurrency,
    fiscalCurrency: "CDF",
  };
}
