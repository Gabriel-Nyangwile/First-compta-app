import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const rows = await prisma.auditLog.findMany({
    where: { companyId: null },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      action: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const resolvable = [];
  const unresolved = [];

  for (const row of rows) {
    let companyId = null;

    if (row.entityType === "PurchaseOrder") {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: row.entityId },
        select: { companyId: true, number: true },
      });
      companyId = po?.companyId || null;
    }

    // Historical fallback: if the audit predates the creation of any later company,
    // attach it to the earliest company that already existed at that timestamp.
    if (!companyId) {
      const matchingCompany = companies
        .filter((company) => company.createdAt <= row.createdAt)
        .at(-1);
      companyId = matchingCompany?.id || null;
    }

    if (companyId) {
      resolvable.push({ ...row, companyId });
    } else {
      unresolved.push(row);
    }
  }

  console.log(`mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`auditLogs.total: ${rows.length}`);
  console.log(`auditLogs.resolvable: ${resolvable.length}`);
  console.log(`auditLogs.unresolved: ${unresolved.length}`);

  if (resolvable.length) {
    console.log("\nResolvable audit logs:");
    for (const row of resolvable.slice(0, 10)) {
      console.log(`- ${row.id} ${row.entityType}/${row.entityId} -> ${row.companyId}`);
    }
  }

  if (unresolved.length) {
    console.log("\nUnresolved audit logs:");
    for (const row of unresolved.slice(0, 10)) {
      console.log(`- ${row.id} ${row.entityType}/${row.entityId}`);
    }
  }

  if (!apply) return;

  for (const row of resolvable) {
    await prisma.auditLog.update({
      where: { id: row.id },
      data: { companyId: row.companyId },
    });
  }

  console.log("\nBackfill applied.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
