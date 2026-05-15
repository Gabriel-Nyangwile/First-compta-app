export const DEFAULT_DEMO_COMPANY_NAME = "Strategic Business Démo";

function normalizeText(value) {
  return value
    ?.toString?.()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase() || "";
}

export function configuredDemoCompanyId() {
  return process.env.DEMO_COMPANY_ID?.toString?.().trim() || "";
}

export function configuredDemoCompanyName() {
  return process.env.DEMO_COMPANY_NAME?.toString?.().trim() || DEFAULT_DEMO_COMPANY_NAME;
}

export function isDemoCompany(company) {
  if (!company) return false;
  const demoId = configuredDemoCompanyId();
  if (demoId && company.id === demoId) return true;

  const name = normalizeText(company.name);
  const configuredName = normalizeText(configuredDemoCompanyName());
  if (configuredName && name === configuredName) return true;

  return name.includes("strategic business") && name.includes("demo");
}

export function findDemoCompany(companies = []) {
  return companies.find(isDemoCompany) || null;
}
