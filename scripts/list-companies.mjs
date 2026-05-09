import prisma from "../src/lib/prisma.js";
import { companyScopedModels, dbLabel, delegateName } from "./company-transfer-utils.mjs";

const keyModels = [
  "Account",
  "Transaction",
  "JournalEntry",
  "Product",
  "Client",
  "Supplier",
  "Employee",
  "Invoice",
  "IncomingInvoice",
  "PurchaseOrder",
  "GoodsReceipt",
  "Payslip",
];

async function countModel(modelName, companyId) {
  const delegate = prisma[delegateName(modelName)];
  if (!delegate?.count) return 0;
  return delegate.count({ where: { companyId } });
}

async function main() {
  console.log(`[companies] DB: ${dbLabel()}`);

  const companies = await prisma.company.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      memberships: { select: { id: true } },
    },
  });
  const allModels = companyScopedModels();
  const rows = [];

  for (const company of companies) {
    const keyCounts = {};
    for (const modelName of keyModels) {
      keyCounts[modelName] = await countModel(modelName, company.id);
    }

    let total = 0;
    for (const modelName of allModels) {
      total += await countModel(modelName, company.id);
    }

    rows.push({
      id: company.id,
      name: company.name,
      total,
      accounts: keyCounts.Account,
      transactions: keyCounts.Transaction,
      journals: keyCounts.JournalEntry,
      products: keyCounts.Product,
      employees: keyCounts.Employee,
      payslips: keyCounts.Payslip,
      invoices: keyCounts.Invoice,
      incomingInvoices: keyCounts.IncomingInvoice,
      purchaseOrders: keyCounts.PurchaseOrder,
      memberships: company.memberships.length,
      createdAt: company.createdAt.toISOString(),
    });
  }

  console.table(rows);
}

main()
  .catch((error) => {
    console.error("[companies] Échec:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
