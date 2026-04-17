#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const companyId = getValue('--companyId') || null;
  const limitRaw = getValue('--limit');
  const limit = Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0 ? Number(limitRaw) : 10;
  const asJson = args.includes('--json');
  return { companyId, limit, asJson };
}

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return value?.toNumber?.() ?? Number(value) ?? 0;
}

function formatExample(example) {
  return Object.entries(example)
    .map(([key, value]) => `${key}=${value == null ? 'null' : value}`)
    .join(' ');
}

async function findCrossCompanyTransactions(limit, companyId) {
  const rows = await prisma.transaction.findMany({
    where: companyId ? { companyId } : {},
    select: {
      id: true,
      companyId: true,
      accountId: true,
      invoiceId: true,
      clientId: true,
      supplierId: true,
      incomingInvoiceId: true,
      moneyMovementId: true,
      journalEntryId: true,
      account: { select: { companyId: true, number: true } },
      invoice: { select: { companyId: true, invoiceNumber: true } },
      client: { select: { companyId: true, name: true } },
      supplier: { select: { companyId: true, name: true } },
      incomingInvoice: { select: { companyId: true, entryNumber: true } },
      moneyMovement: { select: { companyId: true, voucherRef: true } },
      journalEntry: { select: { companyId: true, number: true } },
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: Math.max(limit * 5, 50),
  });

  const mismatches = [];
  for (const row of rows) {
    const checks = [
      ['account', row.accountId, row.account?.companyId, row.account?.number],
      ['invoice', row.invoiceId, row.invoice?.companyId, row.invoice?.invoiceNumber],
      ['client', row.clientId, row.client?.companyId, row.client?.name],
      ['supplier', row.supplierId, row.supplier?.companyId, row.supplier?.name],
      ['incomingInvoice', row.incomingInvoiceId, row.incomingInvoice?.companyId, row.incomingInvoice?.entryNumber],
      ['moneyMovement', row.moneyMovementId, row.moneyMovement?.companyId, row.moneyMovement?.voucherRef],
      ['journalEntry', row.journalEntryId, row.journalEntry?.companyId, row.journalEntry?.number],
    ];
    for (const [type, refId, relatedCompanyId, refLabel] of checks) {
      if (!refId || !relatedCompanyId || relatedCompanyId === row.companyId) continue;
      mismatches.push({
        transactionId: row.id,
        transactionCompanyId: row.companyId,
        relation: type,
        relatedId: refId,
        relatedCompanyId,
        relatedLabel: refLabel || null,
      });
    }
  }

  return {
    count: mismatches.length,
    examples: mismatches.slice(0, limit),
  };
}

async function main() {
  const { companyId, limit, asJson } = parseArgs(process.argv);

  const whereCompany = companyId ? { companyId } : {};
  const journalWhere = companyId ? { companyId } : {};
  const transactionWhere = companyId ? { companyId } : {};

  const [
    companies,
    emptyJournalCount,
    emptyJournalExamples,
    orphanTransactionCount,
    orphanTransactionExamples,
    transactionsWithJournal,
    nullableScopedCounts,
  ] = await Promise.all([
    prisma.company.findMany({
      where: companyId ? { id: companyId } : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.journalEntry.count({
      where: {
        ...journalWhere,
        lines: { none: {} },
      },
    }),
    prisma.journalEntry.findMany({
      where: {
        ...journalWhere,
        lines: { none: {} },
      },
      select: { id: true, number: true, companyId: true, date: true, sourceType: true, sourceId: true },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: limit,
    }),
    prisma.transaction.count({
      where: {
        ...transactionWhere,
        journalEntryId: null,
      },
    }),
    prisma.transaction.findMany({
      where: {
        ...transactionWhere,
        journalEntryId: null,
      },
      select: {
        id: true,
        companyId: true,
        date: true,
        kind: true,
        amount: true,
        account: { select: { number: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
    prisma.transaction.findMany({
      where: {
        ...transactionWhere,
        journalEntryId: { not: null },
      },
      select: {
        id: true,
        companyId: true,
        journalEntryId: true,
        journalEntry: { select: { companyId: true, number: true } },
      },
      take: Math.max(limit * 5, 50),
    }),
    Promise.resolve([0, 0, 0, 0, 0, 0, 0]),
  ]);

  const byCompany = [];
  for (const company of companies) {
    const scopedId = company.id;
    const [journalEntries, transactions, emptyJournals, accounts, users] = await Promise.all([
      prisma.journalEntry.count({ where: { companyId: scopedId } }),
      prisma.transaction.count({ where: { companyId: scopedId } }),
      prisma.journalEntry.count({ where: { companyId: scopedId, lines: { none: {} } } }),
      prisma.account.count({ where: { companyId: scopedId } }),
      prisma.user.count({ where: { companyId: scopedId } }),
    ]);
    byCompany.push({
      companyId: scopedId,
      companyName: company.name,
      journalEntries,
      transactions,
      emptyJournals,
      accounts,
      users,
    });
  }

  const crossCompanyTransactions = await findCrossCompanyTransactions(limit, companyId);
  const transactionCompanyMismatch = transactionsWithJournal
    .filter((row) => row.journalEntry?.companyId && row.journalEntry.companyId !== row.companyId)
    .slice(0, limit);

  const report = {
    scope: companyId || 'ALL',
    companies: byCompany,
    emptyJournals: {
      count: emptyJournalCount,
      examples: emptyJournalExamples.map((row) => ({
        id: row.id,
        number: row.number,
        companyId: row.companyId,
        date: row.date?.toISOString?.()?.slice(0, 10) || null,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
      })),
    },
    orphanTransactions: {
      count: orphanTransactionCount,
      examples: orphanTransactionExamples.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        date: row.date?.toISOString?.()?.slice(0, 10) || null,
        kind: row.kind,
        amount: toNumber(row.amount).toFixed(2),
        accountNumber: row.account?.number || null,
      })),
    },
    crossCompanyTransactions,
    journalTransactionCompanyMismatch: {
      count: transactionsWithJournal.filter((row) => row.journalEntry?.companyId && row.journalEntry.companyId !== row.companyId).length,
      examples: transactionCompanyMismatch.map((row) => ({
        transactionId: row.id,
        transactionCompanyId: row.companyId,
        journalEntryId: row.journalEntryId,
        journalCompanyId: row.journalEntry?.companyId || null,
        journalNumber: row.journalEntry?.number || null,
      })),
    },
    nullCompanyIds: {
      transactions: nullableScopedCounts[0],
      journalEntries: nullableScopedCounts[1],
      accounts: nullableScopedCounts[2],
      users: nullableScopedCounts[3],
      invoices: nullableScopedCounts[4],
      incomingInvoices: nullableScopedCounts[5],
      moneyMovements: nullableScopedCounts[6],
    },
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('=== Audit Multi-Company ===');
  console.log(`Scope: ${report.scope}`);
  if (!report.companies.length) {
    console.log('No company found for scope.');
  } else {
    console.log('\nCompanies:');
    for (const item of report.companies) {
      console.log(
        `- ${item.companyName} (${item.companyId}) | journals=${item.journalEntries} transactions=${item.transactions} emptyJournals=${item.emptyJournals} accounts=${item.accounts} users=${item.users}`
      );
    }
  }

  const sections = [
    ['Empty journals', report.emptyJournals],
    ['Orphan transactions', report.orphanTransactions],
    ['Cross-company transaction relations', report.crossCompanyTransactions],
    ['Journal/transaction company mismatch', report.journalTransactionCompanyMismatch],
  ];

  for (const [title, section] of sections) {
    console.log(`\n${title}: ${section.count}`);
    for (const example of section.examples) {
      console.log(`  - ${formatExample(example)}`);
    }
  }

  console.log('\nNull companyId counts:');
  for (const [key, value] of Object.entries(report.nullCompanyIds)) {
    console.log(`- ${key}: ${value}`);
  }
}

main()
  .catch((error) => {
    console.error('audit-multi-company error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
