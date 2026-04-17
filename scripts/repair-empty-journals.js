#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';
import { isBasePayrollJournal, isPayrollReversalDescription } from '../src/lib/payroll/journals.js';

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
  const limitRaw = getValue('--limit');
  const limit = Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0 ? Number(limitRaw) : 20;
  if (!companyId && !all) {
    throw new Error('Usage: node scripts/repair-empty-journals.js --companyId <id> [--dry-run|--apply] ou --all [--dry-run|--apply]');
  }
  return { companyId, all, dryRun, limit };
}

function pushBucket(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function sourceKey(journal) {
  return `${journal.sourceType || 'OTHER'}|${journal.sourceId || 'NO_SOURCE'}`;
}

function buildEmptyType(journal) {
  if (journal._count.depreciationLines > 0) return 'asset_depreciation_ref';
  if (journal._count.assetDisposals > 0) return 'asset_disposal_ref';
  if (journal._count.inventoryCountLines > 0) return 'inventory_count_ref';
  if (journal._count.capitalPayments > 0) return 'capital_payment_ref';
  if (journal.sourceType === 'PAYROLL') return 'payroll';
  if (journal.sourceType === 'GOODS_RECEIPT') return 'goods_receipt';
  if (journal.sourceType === 'INCOMING_INVOICE') return 'incoming_invoice';
  if (journal.sourceType === 'MONEY_MOVEMENT') return 'money_movement';
  if (journal.sourceType === 'MANUAL') return 'manual';
  return 'other';
}

function summarizeExamples(rows, limit) {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    number: row.number,
    companyId: row.companyId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    date: row.date?.toISOString?.()?.slice(0, 10) || null,
    classification: row.classification,
    suggestedAction: row.suggestedAction,
  }));
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

function classifyJournals(emptyJournals, allJournals) {
  const bySource = new Map();
  for (const journal of allJournals) pushBucket(bySource, sourceKey(journal), journal);

  return emptyJournals.map((journal) => {
    const related = bySource.get(sourceKey(journal)) || [];
    const nonEmptyRelated = related.filter((item) => item._count.lines > 0);
    const otherEmptyRelated = related.filter((item) => item.id !== journal.id && item._count.lines === 0);

    const baseType = buildEmptyType(journal);
    let classification = baseType;
    let suggestedAction = 'inspect_manually';

    if (baseType === 'payroll') {
      const currentBase = nonEmptyRelated.find((item) => isBasePayrollJournal(item));
      const hasReversal = related.some((item) => isPayrollReversalDescription(item.description));
      if (currentBase) {
        classification = hasReversal ? 'payroll_superseded_with_reversal' : 'payroll_superseded';
        suggestedAction = 'detach_sourceId';
      } else if (otherEmptyRelated.length > 0) {
        classification = 'payroll_duplicates_without_lines';
        suggestedAction = 'inspect_manually';
      } else {
        classification = 'payroll_missing_transactions';
        suggestedAction = 'rebuild_from_payroll_source';
      }
    } else if (baseType === 'asset_depreciation_ref' || baseType === 'asset_disposal_ref') {
      suggestedAction = 'rebuild_from_asset_source';
    } else if (baseType === 'goods_receipt') {
      classification = nonEmptyRelated.length > 0 ? 'goods_receipt_duplicate' : 'goods_receipt_missing_transactions';
      suggestedAction = nonEmptyRelated.length > 0 ? 'inspect_manually' : 'rebuild_from_goods_receipt_source';
    } else if (baseType === 'incoming_invoice') {
      classification = nonEmptyRelated.length > 0 ? 'incoming_invoice_duplicate' : 'incoming_invoice_missing_transactions';
      suggestedAction = nonEmptyRelated.length > 0 ? 'inspect_manually' : 'rebuild_from_incoming_invoice_source';
    } else if (baseType === 'money_movement') {
      classification = nonEmptyRelated.length > 0 ? 'money_movement_duplicate' : 'money_movement_missing_transactions';
      suggestedAction = nonEmptyRelated.length > 0 ? 'inspect_manually' : 'rebuild_from_money_movement_source';
    } else if (baseType === 'manual' || baseType === 'other') {
      classification = nonEmptyRelated.length > 0 ? `${baseType}_duplicate` : `${baseType}_empty`;
      suggestedAction = nonEmptyRelated.length > 0 ? 'inspect_manually' : 'leave_untouched';
    }

    return {
      ...journal,
      relatedCount: related.length,
      nonEmptyRelatedCount: nonEmptyRelated.length,
      classification,
      suggestedAction,
    };
  });
}

async function processCompany(company, { dryRun, limit }) {
  const allJournals = await prisma.journalEntry.findMany({
    where: { companyId: company.id },
    select: {
      id: true,
      number: true,
      companyId: true,
      sourceType: true,
      sourceId: true,
      date: true,
      description: true,
      _count: {
        select: {
          lines: true,
          depreciationLines: true,
          assetDisposals: true,
          inventoryCountLines: true,
          capitalPayments: true,
        },
      },
    },
    orderBy: [{ date: 'desc' }, { number: 'desc' }],
  });

  const emptyJournals = allJournals.filter((item) => item._count.lines === 0);
  const classified = classifyJournals(emptyJournals, allJournals);

  const buckets = {};
  for (const row of classified) {
    buckets[row.classification] = (buckets[row.classification] || 0) + 1;
  }

  const detachablePayroll = classified.filter((row) => row.suggestedAction === 'detach_sourceId');

  if (!dryRun && detachablePayroll.length) {
    for (const row of detachablePayroll) {
      await prisma.journalEntry.update({
        where: { id: row.id },
        data: { sourceId: null },
      });
    }
  }

  return {
    companyId: company.id,
    companyName: company.name,
    emptyJournalCount: emptyJournals.length,
    detachedPayrollCount: dryRun ? 0 : detachablePayroll.length,
    classifications: buckets,
    examples: summarizeExamples(classified, limit),
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const companies = await resolveCompanies(options);
  console.log(`Repair empty journals (${options.dryRun ? 'dry-run' : 'apply'})...`);

  for (const company of companies) {
    const report = await processCompany(company, options);
    console.log(`- ${report.companyName} (${report.companyId}) | empty=${report.emptyJournalCount} detachedPayroll=${report.detachedPayrollCount}`);
    const classes = Object.entries(report.classifications).sort((a, b) => b[1] - a[1]);
    for (const [label, count] of classes) {
      console.log(`  ${label}: ${count}`);
    }
    for (const example of report.examples) {
      console.log(
        `  EX ${example.number} ${example.sourceType}:${example.sourceId || ''} ${example.classification} -> ${example.suggestedAction}`
      );
    }
  }

  if (options.dryRun) {
    console.log('Dry-run complete. Re-run with --apply to detach only payroll superseded empty journals.');
  }
}

main()
  .catch((error) => {
    console.error('[repair-empty-journals] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
