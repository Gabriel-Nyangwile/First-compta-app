#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

function pick(val, fallback = null) {
  if (val == null) return fallback;
  const v = String(val).trim();
  return v.length ? v : fallback;
}

async function main() {
  const envId = pick(process.env.DEFAULT_COMPANY_ID) || pick(process.env.COMPANY_ID);
  const name = pick(process.env.DEFAULT_COMPANY_NAME, "Entreprise par defaut");
  const currency = pick(process.env.DEFAULT_COMPANY_CURRENCY, "XOF");
  const legalForm = pick(process.env.DEFAULT_COMPANY_LEGAL_FORM, null);

  let company = envId
    ? await prisma.company.findUnique({ where: { id: envId } })
    : await prisma.company.findFirst({ where: { name } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        id: envId || undefined,
        name,
        currency,
        legalForm,
      },
    });
  }

  const companyId = company.id;
  console.log(`Using companyId=${companyId} (${company.name})`);

  const models = [
    "sequence",
    "payment",
    "paymentInvoiceLink",
    "lettering",
    "user",
    "account",
    "client",
    "supplier",
    "journalEntry",
    "invoice",
    "invoiceLine",
    "salesOrder",
    "salesOrderLine",
    "purchaseOrder",
    "purchaseOrderLine",
    "assetPurchaseOrder",
    "assetPurchaseOrderLine",
    "goodsReceipt",
    "goodsReceiptLine",
    "storageLocation",
    "product",
    "productInventory",
    "stockMovement",
    "stockWithdrawal",
    "stockWithdrawalLine",
    "inventoryCount",
    "inventoryCountLine",
    "transaction",
    "incomingInvoice",
    "incomingInvoiceLine",
    "returnOrder",
    "returnOrderLine",
    "moneyAccount",
    "moneyMovement",
    "purchaseOrderStatusLog",
    "auditLog",
    "treasuryAuthorization",
    "bankAdvice",
    "employee",
    "position",
    "employeeHistory",
    "payrollPeriod",
    "payslip",
    "payslipLine",
    "contributionScheme",
    "taxRule",
    "costCenter",
    "employeeCostAllocation",
    "payslipCostAllocation",
    "payrollAccountMapping",
    "fxRate",
    "assetCategory",
    "asset",
    "depreciationLine",
    "depreciationPeriodLock",
    "assetDisposal",
    "employeeAttendance",
    "payrollVariable",
    "shareholder",
    "capitalOperation",
    "capitalSubscription",
    "capitalCall",
    "capitalPayment",
  ];

  // Bareme: merge duplicates by category (keep earliest, reattach positions, delete others).
  const baremes = await prisma.bareme.findMany({
    where: { companyId: null },
    orderBy: { createdAt: "asc" },
  });
  if (baremes.length) {
    const groups = new Map();
    for (const b of baremes) {
      const key = String(b.category || "").trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    for (const [category, list] of groups.entries()) {
      const canonical = list[0];
      const dupes = list.slice(1);
      await prisma.bareme.update({
        where: { id: canonical.id },
        data: { companyId },
      });
      if (!dupes.length) continue;
      const dupeIds = dupes.map((d) => d.id);
      await prisma.position.updateMany({
        where: { baremeId: { in: dupeIds } },
        data: { baremeId: canonical.id },
      });
      await prisma.bareme.deleteMany({ where: { id: { in: dupeIds } } });
      console.log(`bareme: merged ${dupes.length} duplicate(s) into "${category}"`);
    }
  }

  for (const model of models) {
    const client = prisma[model];
    if (!client?.updateMany) continue;
    try {
      const res = await client.updateMany({
        where: { companyId: null },
        data: { companyId },
      });
      if (res?.count) {
        console.log(`${model}: ${res.count} rows updated`);
      }
    } catch (err) {
      console.error(`${model}: backfill failed`, err?.message || err);
    }
  }
}

main().catch((err) => {
  console.error("backfill-company error:", err.message || err);
  process.exit(1);
});
