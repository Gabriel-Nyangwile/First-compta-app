import prisma from "../src/lib/prisma.js";
import { getMissionAdvanceOverview } from "../src/lib/serverActions/money.js";

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const report = [];
  for (const company of companies) {
    const overview = await getMissionAdvanceOverview({ companyId: company.id });
    const critical = overview.rows.filter((row) => row.ageDays > 90);
    report.push({
      company: company.name,
      totalOpenCount: overview.summary.totalOpenCount,
      totalOpenAmount: overview.summary.totalOpenAmount,
      maxAgeDays: overview.summary.maxAgeDays,
      criticalCount: critical.length,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error("audit-open-mission-advances: FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
