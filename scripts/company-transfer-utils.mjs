import { Prisma } from "@prisma/client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SKIPPED_BY_DEFAULT = new Set([
  "User",
  "CompanyMembership",
  "CompanyCreationRequest",
  "AuditLog",
]);

export const MODEL_ORDER_HINT = [
  "Sequence",
  "Account",
  "Client",
  "Supplier",
  "StorageLocation",
  "Product",
  "ProductInventory",
  "AssetCategory",
  "Asset",
  "Position",
  "Bareme",
  "ContributionScheme",
  "TaxRule",
  "CostCenter",
  "Employee",
  "EmployeeHistory",
  "EmployeeCostAllocation",
  "MoneyAccount",
  "BillOfMaterial",
  "BillOfMaterialLine",
  "ManufacturingOrder",
  "ManufacturingOrderComponent",
  "ManufacturingOutput",
  "SalesOrder",
  "SalesOrderLine",
  "PurchaseOrder",
  "PurchaseOrderLine",
  "AssetPurchaseOrder",
  "AssetPurchaseOrderLine",
  "GoodsReceipt",
  "GoodsReceiptLine",
  "Invoice",
  "InvoiceLine",
  "IncomingInvoice",
  "IncomingInvoiceLine",
  "ReturnOrder",
  "ReturnOrderLine",
  "StockWithdrawal",
  "StockWithdrawalLine",
  "InventoryCount",
  "InventoryCountLine",
  "TreasuryAuthorization",
  "BankAdvice",
  "MoneyMovement",
  "Payment",
  "PaymentInvoiceLink",
  "JournalEntry",
  "Transaction",
  "StockMovement",
  "Lettering",
  "MissionAdvanceRegularization",
  "PurchaseOrderStatusLog",
  "PayrollAccountMapping",
  "FxRate",
  "PayrollPeriod",
  "EmployeeAttendance",
  "PayrollVariable",
  "Payslip",
  "PayslipLine",
  "PayslipCostAllocation",
  "DepreciationLine",
  "DepreciationPeriodLock",
  "AssetDisposal",
  "Shareholder",
  "CapitalOperation",
  "CapitalSubscription",
  "CapitalCall",
  "CapitalPayment",
  "FiscalYearClosing",
];

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function isStrategicDemoName(value) {
  const normalized = normalizeText(value);
  return normalized.includes("strategic") && normalized.includes("business");
}

export function delegateName(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

export function modelByName(modelName) {
  return Prisma.dmmf.datamodel.models.find((model) => model.name === modelName);
}

export function companyScopedModels({ includeSecurity = false, includeAudit = false } = {}) {
  const models = Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.kind === "scalar" && field.name === "companyId"))
    .map((model) => model.name)
    .filter((name) => {
      if (name === "AuditLog") return includeAudit;
      if (SKIPPED_BY_DEFAULT.has(name)) return includeSecurity;
      return true;
    });

  return sortModels(models);
}

export function sortModels(models) {
  const wanted = new Set(models);
  const hintRank = new Map(MODEL_ORDER_HINT.map((name, index) => [name, index]));
  const dependencies = new Map();

  for (const modelName of models) {
    const model = modelByName(modelName);
    const deps = new Set();
    for (const field of model?.fields || []) {
      if (field.kind !== "object" || field.type === modelName || !wanted.has(field.type)) continue;
      if (field.relationFromFields?.length) deps.add(field.type);
    }
    dependencies.set(modelName, deps);
  }

  const ordered = [];
  const remaining = new Set(models);
  while (remaining.size) {
    const ready = [...remaining]
      .filter((name) => [...(dependencies.get(name) || [])].every((dep) => !remaining.has(dep)))
      .sort((a, b) => (hintRank.get(a) ?? 999) - (hintRank.get(b) ?? 999) || a.localeCompare(b));
    if (!ready.length) break;
    for (const name of ready) {
      ordered.push(name);
      remaining.delete(name);
    }
  }

  const unresolved = [...remaining].sort(
    (a, b) => (hintRank.get(a) ?? 999) - (hintRank.get(b) ?? 999) || a.localeCompare(b),
  );
  return [...ordered, ...unresolved];
}

export async function findSourceCompany(prisma, { companyId, companyName } = {}) {
  if (companyId) return prisma.company.findUnique({ where: { id: companyId } });

  const companies = await prisma.company.findMany({ orderBy: [{ createdAt: "asc" }, { name: "asc" }] });
  if (companyName) {
    const wanted = normalizeText(companyName);
    return companies.find((company) => normalizeText(company.name) === wanted) || null;
  }
  return companies.find((company) => isStrategicDemoName(company.name)) || null;
}

export function dbLabel(databaseUrl = process.env.DATABASE_URL) {
  try {
    const url = new URL(databaseUrl);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "DATABASE_URL illisible";
  }
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function safeSlug(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
}

export async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function reviveRow(modelName, row, { companyId, preserveUserRefs = false } = {}) {
  const model = modelByName(modelName);
  const dateFields = new Set(
    (model?.fields || [])
      .filter((field) => field.kind === "scalar" && field.type === "DateTime")
      .map((field) => field.name),
  );
  const userForeignKeys = new Set();
  for (const field of model?.fields || []) {
    if (field.kind === "object" && field.type === "User" && field.relationFromFields?.length) {
      for (const fk of field.relationFromFields) userForeignKeys.add(fk);
    }
  }

  const revived = { ...row };
  if (companyId && Object.prototype.hasOwnProperty.call(revived, "companyId")) revived.companyId = companyId;
  if (!preserveUserRefs) {
    for (const fk of userForeignKeys) {
      if (Object.prototype.hasOwnProperty.call(revived, fk)) revived[fk] = null;
    }
  }
  for (const field of dateFields) {
    if (revived[field]) revived[field] = new Date(revived[field]);
  }
  return revived;
}

export async function importInBatches(delegate, rows, batchSize = 200) {
  let inserted = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const result = await delegate.createMany({ data: batch, skipDuplicates: true });
    inserted += result.count;
  }
  return inserted;
}
