#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

const SOURCE_CONFIG = {
  INVOICE: {
    model: 'invoice',
    labelField: 'invoiceNumber',
  },
  INCOMING_INVOICE: {
    model: 'incomingInvoice',
    labelField: 'entryNumber',
  },
  MONEY_MOVEMENT: {
    model: 'moneyMovement',
    labelField: 'voucherRef',
  },
  GOODS_RECEIPT: {
    model: 'goodsReceipt',
    labelField: 'number',
  },
  PAYROLL: {
    model: 'payrollPeriod',
    labelField: 'ref',
  },
  ASSET: {
    model: 'asset',
    labelField: 'ref',
  },
  RETURN_ORDER: {
    model: 'returnOrder',
    labelField: 'number',
  },
  CAPITAL: {
    model: 'capitalOperation',
    labelField: 'ref',
  },
};

const RISK_HINTS = {
  INCOMING_INVOICE: [
    'scripts/admin-delete-incoming-invoice.js',
    'src/app/api/incoming-invoices/[id]/route.js',
    'scripts/reset-data.js',
  ],
  GOODS_RECEIPT: [
    'scripts/purge-stock-domain.js',
    'scripts/reset-data.js',
  ],
  MONEY_MOVEMENT: [
    'scripts/reset-data.js',
    'src/app/api/bank-advices/[id]/route.js',
  ],
  PAYROLL: [
    'scripts/admin-delete-test-personnel-and-future-periods.js',
    'scripts/purge-payroll.js',
  ],
  ASSET: [
    'scripts/purge-asset-data.mjs',
    'src/app/api/assets/[id]/route.js',
  ],
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const companyId = getValue('--companyId') || null;
  const all = args.includes('--all');
  const asJson = args.includes('--json');
  const limitRaw = getValue('--limit');
  const limit = Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0 ? Number(limitRaw) : 20;
  if (!companyId && !all) {
    throw new Error('Usage: node scripts/audit-dangling-journal-sources.js --companyId <id> [--json] [--limit N] ou --all ...');
  }
  return { companyId, all, asJson, limit };
}

async function resolveCompanies({ companyId, all }) {
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
    if (!company) throw new Error(`companyId introuvable: ${companyId}`);
    return [company];
  }
  if (!all) return [];
  return prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

async function sourceExists(sourceType, sourceId, companyId) {
  const config = SOURCE_CONFIG[sourceType];
  if (!config || !sourceId) return { exists: null, label: null, supported: false };
  const where = { id: sourceId };
  if (companyId) where.companyId = companyId;
  try {
    const row = await prisma[config.model].findFirst({
      where,
      select: { id: true, [config.labelField]: true },
    });
    return {
      exists: !!row,
      label: row?.[config.labelField] || null,
      supported: true,
    };
  } catch {
    return { exists: null, label: null, supported: false };
  }
}

async function auditCompany(company, limit) {
  const journals = await prisma.journalEntry.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      number: true,
      companyId: true,
      sourceType: true,
      sourceId: true,
      date: true,
      description: true,
      _count: { select: { lines: true } },
    },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
  });

  const dangling = [];
  for (const journal of journals) {
    if (!journal.sourceType || !journal.sourceId) continue;
    const sourceCheck = await sourceExists(journal.sourceType, journal.sourceId, company.id);
    if (sourceCheck.supported && sourceCheck.exists === false) {
      dangling.push({
        id: journal.id,
        number: journal.number,
        companyId: journal.companyId,
        sourceType: journal.sourceType,
        sourceId: journal.sourceId,
        date: journal.date?.toISOString?.()?.slice(0, 10) || null,
        description: journal.description || null,
        lineCount: journal._count.lines,
        riskHints: RISK_HINTS[journal.sourceType] || [],
      });
    }
  }

  const byType = {};
  for (const row of dangling) {
    byType[row.sourceType] = (byType[row.sourceType] || 0) + 1;
  }

  const emptyDangling = dangling.filter((row) => row.lineCount === 0);
  const nonEmptyDangling = dangling.filter((row) => row.lineCount > 0);

  return {
    companyId: company.id,
    companyName: company.name,
    danglingCount: dangling.length,
    emptyDanglingCount: emptyDangling.length,
    nonEmptyDanglingCount: nonEmptyDangling.length,
    byType,
    examples: dangling.slice(0, limit),
  };
}

async function main() {
  const { companyId, all, asJson, limit } = parseArgs(process.argv);
  const companies = await resolveCompanies({ companyId, all });
  const reports = [];
  for (const company of companies) {
    reports.push(await auditCompany(company, limit));
  }

  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }

  console.log('=== Audit Dangling Journal Sources ===');
  for (const report of reports) {
    console.log(`- ${report.companyName} (${report.companyId}) | dangling=${report.danglingCount} empty=${report.emptyDanglingCount} nonEmpty=${report.nonEmptyDanglingCount}`);
    for (const [type, count] of Object.entries(report.byType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`);
    }
    for (const ex of report.examples) {
      console.log(`  EX ${ex.number} ${ex.sourceType}:${ex.sourceId} lines=${ex.lineCount}`);
      if (ex.riskHints.length) console.log(`    hints: ${ex.riskHints.join(', ')}`);
    }
  }
}

main()
  .catch((error) => {
    console.error('[audit-dangling-journal-sources] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
