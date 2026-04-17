#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';
import { getSystemAccounts } from '../src/lib/systemAccounts.js';

const SUPPORTED_TYPES = new Set(['INCOMING_INVOICE', 'GOODS_RECEIPT', 'MONEY_MOVEMENT']);

function parseArgs(argv) {
  const args = argv.slice(2);
  const getValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const companyId = getValue('--companyId') || null;
  const all = args.includes('--all');
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run') || !apply;
  const typeArg = getValue('--type');
  const type = typeArg ? typeArg.toUpperCase() : null;
  if (type && !SUPPORTED_TYPES.has(type)) {
    throw new Error(`Unsupported --type ${type}. Expected one of: ${Array.from(SUPPORTED_TYPES).join(', ')}`);
  }
  if (!companyId && !all) {
    throw new Error('Usage: node scripts/rebuild-empty-journal-sources.js --companyId <id> [--type INCOMING_INVOICE|GOODS_RECEIPT|MONEY_MOVEMENT] [--dry-run|--apply] ou --all ...');
  }
  return { companyId, all, dryRun, type };
}

function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return value?.toNumber?.() ?? Number(value) ?? 0;
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

async function loadEmptyJournalGroups(companyId, type = null) {
  const journals = await prisma.journalEntry.findMany({
    where: {
      companyId,
      lines: { none: {} },
      ...(type ? { sourceType: type } : { sourceType: { in: Array.from(SUPPORTED_TYPES) } }),
    },
    select: {
      id: true,
      number: true,
      sourceType: true,
      sourceId: true,
      companyId: true,
      date: true,
      description: true,
    },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
  });

  const groups = new Map();
  for (const journal of journals) {
    const key = `${journal.sourceType}|${journal.sourceId || 'NO_SOURCE'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(journal);
  }
  return groups;
}

async function rebuildIncomingInvoice(tx, companyId, journal, sourceId) {
  const invoice = await tx.incomingInvoice.findFirst({
    where: { id: sourceId, companyId },
    include: { supplier: true, lines: true },
  });
  if (!invoice) return { status: 'dangling_source' };
  const existingTxCount = await tx.transaction.count({ where: { companyId, incomingInvoiceId: invoice.id } });
  if (existingTxCount > 0) return { status: 'existing_transactions', count: existingTxCount };
  if (!invoice.supplier?.accountId) return { status: 'missing_supplier_account' };

  const { vatDeductibleAccount } = await getSystemAccounts(companyId);
  const createdIds = [];

  for (const line of invoice.lines) {
    const created = await tx.transaction.create({
      data: {
        companyId,
        date: invoice.receiptDate || journal.date || new Date(),
        nature: 'purchase',
        description: line.description,
        amount: line.lineTotal,
        direction: 'DEBIT',
        kind: 'PURCHASE',
        accountId: line.accountId,
        incomingInvoiceId: invoice.id,
        incomingInvoiceLineId: line.id,
        supplierId: invoice.supplierId,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  if (toNumber(invoice.vatAmount) > 0 && vatDeductibleAccount?.id) {
    const created = await tx.transaction.create({
      data: {
        companyId,
        date: invoice.receiptDate || journal.date || new Date(),
        nature: 'purchase',
        description: `TVA déductible facture ${invoice.entryNumber}`,
        amount: invoice.vatAmount,
        direction: 'DEBIT',
        kind: 'VAT_DEDUCTIBLE',
        accountId: vatDeductibleAccount.id,
        incomingInvoiceId: invoice.id,
        supplierId: invoice.supplierId,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  const payable = await tx.transaction.create({
    data: {
      companyId,
      date: invoice.receiptDate || journal.date || new Date(),
      nature: 'purchase',
      description: `Dette fournisseur facture ${invoice.entryNumber}`,
      amount: invoice.totalAmount,
      direction: 'CREDIT',
      kind: 'PAYABLE',
      accountId: invoice.supplier.accountId,
      incomingInvoiceId: invoice.id,
      supplierId: invoice.supplierId,
      journalEntryId: journal.id,
    },
    select: { id: true },
  });
  createdIds.push(payable.id);

  return { status: 'rebuilt', transactionIds: createdIds };
}

async function rebuildMoneyMovement(tx, companyId, journal, sourceId) {
  const movement = await tx.moneyMovement.findFirst({
    where: { id: sourceId, companyId },
    include: {
      moneyAccount: { include: { ledgerAccount: true } },
      invoice: { include: { client: true } },
      incomingInvoice: { include: { supplier: true } },
    },
  });
  if (!movement) return { status: 'dangling_source' };
  const existingTxCount = await tx.transaction.count({ where: { companyId, moneyMovementId: movement.id } });
  if (existingTxCount > 0) return { status: 'existing_transactions', count: existingTxCount };
  if (!movement.moneyAccount?.ledgerAccountId) return { status: 'missing_money_account_ledger' };

  const createdIds = [];
  const treasury = await tx.transaction.create({
    data: {
      companyId,
      date: movement.date,
      nature: 'payment',
      description: movement.description || movement.voucherRef || movement.kind,
      amount: movement.amount,
      direction: movement.direction === 'IN' ? 'DEBIT' : 'CREDIT',
      kind: 'PAYMENT',
      accountId: movement.moneyAccount.ledgerAccountId,
      moneyMovementId: movement.id,
      invoiceId: movement.invoiceId,
      incomingInvoiceId: movement.incomingInvoiceId,
      supplierId: movement.supplierId,
      journalEntryId: journal.id,
    },
    select: { id: true },
  });
  createdIds.push(treasury.id);

  if (movement.kind === 'SUPPLIER_PAYMENT') {
    const supplierAccountId = movement.incomingInvoice?.supplier?.accountId;
    if (!supplierAccountId) return { status: 'missing_supplier_account_partial', transactionIds: createdIds };
    const counter = await tx.transaction.create({
      data: {
        companyId,
        date: movement.date,
        nature: 'payment',
        description: movement.description || `Paiement fournisseur ${movement.voucherRef || movement.id}`,
        amount: movement.amount,
        direction: 'DEBIT',
        kind: 'PAYABLE',
        accountId: supplierAccountId,
        moneyMovementId: movement.id,
        incomingInvoiceId: movement.incomingInvoiceId,
        supplierId: movement.supplierId || movement.incomingInvoice?.supplierId || null,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(counter.id);
    return { status: 'rebuilt', transactionIds: createdIds };
  }

  if (movement.kind === 'CLIENT_RECEIPT') {
    const clientAccountId = movement.invoice?.client?.accountId;
    if (!clientAccountId) return { status: 'missing_client_account_partial', transactionIds: createdIds };
    const counter = await tx.transaction.create({
      data: {
        companyId,
        date: movement.date,
        nature: 'payment',
        description: movement.description || `Encaissement client ${movement.voucherRef || movement.id}`,
        amount: movement.amount,
        direction: 'CREDIT',
        kind: 'RECEIVABLE',
        accountId: clientAccountId,
        moneyMovementId: movement.id,
        invoiceId: movement.invoiceId,
        journalEntryId: journal.id,
      },
      select: { id: true },
    });
    createdIds.push(counter.id);
    return { status: 'rebuilt', transactionIds: createdIds };
  }

  return { status: 'unsupported_kind', kind: movement.kind, transactionIds: createdIds };
}

async function rebuildGoodsReceipt(tx, companyId, journal, sourceId) {
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id: sourceId, companyId },
    include: {
      lines: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              inventoryAccountId: true,
              stockVariationAccountId: true,
            },
          },
        },
      },
    },
  });
  if (!receipt) return { status: 'dangling_source' };
  const existingTxCount = await tx.transaction.count({ where: { companyId, journalEntryId: journal.id } });
  if (existingTxCount > 0) return { status: 'existing_transactions', count: existingTxCount };

  if (receipt.lines.length !== 1) {
    return { status: 'ambiguous_goods_receipt', lineCount: receipt.lines.length };
  }

  const line = receipt.lines[0];
  const product = line.product;
  if (!product?.inventoryAccountId || !product?.stockVariationAccountId) {
    return { status: 'missing_product_accounts' };
  }
  const amount = Number((toNumber(line.qtyPutAway || line.qtyReceived) * toNumber(line.unitCost)).toFixed(2));
  if (!(amount > 0)) return { status: 'zero_amount' };

  const description = ['Mise en stock', receipt.number || '', product.sku ? `SKU ${product.sku}` : '']
    .filter(Boolean)
    .join(' ');
  const createdIds = [];

  const debit = await tx.transaction.create({
    data: {
      companyId,
      date: receipt.receiptDate || journal.date || new Date(),
      nature: 'inventory',
      description,
      amount: amount.toFixed(2),
      direction: 'DEBIT',
      kind: 'INVENTORY_ASSET',
      accountId: product.inventoryAccountId,
      supplierId: receipt.supplierId || null,
      journalEntryId: journal.id,
    },
    select: { id: true },
  });
  createdIds.push(debit.id);

  const credit = await tx.transaction.create({
    data: {
      companyId,
      date: receipt.receiptDate || journal.date || new Date(),
      nature: 'inventory',
      description,
      amount: amount.toFixed(2),
      direction: 'CREDIT',
      kind: 'STOCK_VARIATION',
      accountId: product.stockVariationAccountId,
      supplierId: receipt.supplierId || null,
      journalEntryId: journal.id,
    },
    select: { id: true },
  });
  createdIds.push(credit.id);

  return { status: 'rebuilt', transactionIds: createdIds };
}

async function processCompany(company, typeFilter, dryRun) {
  const groups = await loadEmptyJournalGroups(company.id, typeFilter);
  const report = [];

  for (const journals of groups.values()) {
    const sample = journals[0];
    if (!sample.sourceId || !SUPPORTED_TYPES.has(sample.sourceType)) continue;

    const entry = {
      companyId: company.id,
      companyName: company.name,
      sourceType: sample.sourceType,
      sourceId: sample.sourceId,
      emptyJournalCount: journals.length,
      chosenJournalNumber: journals[0].number,
      chosenJournalId: journals[0].id,
      status: null,
    };

    if (journals.length !== 1) {
      entry.status = 'ambiguous_multiple_empty_journals';
      report.push(entry);
      continue;
    }

    if (dryRun) {
      let previewStatus = 'unknown';
      if (sample.sourceType === 'INCOMING_INVOICE') {
        const exists = await prisma.incomingInvoice.findFirst({ where: { id: sample.sourceId, companyId: company.id }, select: { id: true } });
        previewStatus = exists ? 'reconstructible_candidate' : 'dangling_source';
      } else if (sample.sourceType === 'GOODS_RECEIPT') {
        const exists = await prisma.goodsReceipt.findFirst({ where: { id: sample.sourceId, companyId: company.id }, select: { id: true } });
        previewStatus = exists ? 'reconstructible_candidate' : 'dangling_source';
      } else if (sample.sourceType === 'MONEY_MOVEMENT') {
        const exists = await prisma.moneyMovement.findFirst({ where: { id: sample.sourceId, companyId: company.id }, select: { id: true } });
        previewStatus = exists ? 'reconstructible_candidate' : 'dangling_source';
      }
      entry.status = previewStatus;
      report.push(entry);
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (sample.sourceType === 'INCOMING_INVOICE') {
        return rebuildIncomingInvoice(tx, company.id, sample, sample.sourceId);
      }
      if (sample.sourceType === 'GOODS_RECEIPT') {
        return rebuildGoodsReceipt(tx, company.id, sample, sample.sourceId);
      }
      if (sample.sourceType === 'MONEY_MOVEMENT') {
        return rebuildMoneyMovement(tx, company.id, sample, sample.sourceId);
      }
      return { status: 'unsupported_type' };
    });
    entry.status = result.status;
    if (result.transactionIds) entry.transactionCount = result.transactionIds.length;
    if (result.count != null) entry.existingTransactionCount = result.count;
    if (result.lineCount != null) entry.lineCount = result.lineCount;
    if (result.kind) entry.kind = result.kind;
    report.push(entry);
  }

  return report;
}

async function main() {
  const { companyId, all, dryRun, type } = parseArgs(process.argv);
  const companies = await resolveCompanies({ companyId, all });
  console.log(`Rebuild empty journal sources (${dryRun ? 'dry-run' : 'apply'})...`);

  for (const company of companies) {
    const report = await processCompany(company, type, dryRun);
    const summary = report.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`- ${company.name} (${company.id})`);
    for (const [status, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${status}: ${count}`);
    }
    for (const row of report) {
      console.log(`  EX ${row.sourceType}:${row.sourceId} -> ${row.status} journal=${row.chosenJournalNumber} emptyCount=${row.emptyJournalCount}`);
    }
  }

  if (dryRun) {
    console.log('Dry-run complete. Re-run with --apply to rebuild only unambiguous and reconstructible sources.');
  }
}

main()
  .catch((error) => {
    console.error('[rebuild-empty-journal-sources] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
