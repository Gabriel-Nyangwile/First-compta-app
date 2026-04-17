#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { deleteUnreferencedEmptyJournalsByIds } from '../src/lib/journalCleanup.js';

function safeStringify(obj){
  return JSON.stringify(obj, (k,v)=>{
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return v.toString();
    return v;
  }, 2);
}

function argFlag(name){ return process.argv.includes(name); }
function argValue(name){
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main(){
  const dryRun = !argFlag('--apply');
  const companyId = argValue('--companyId') || process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  if(!companyId){ console.error('DEFAULT_COMPANY_ID requis'); process.exit(1); }

  const outDir = path.resolve('backups', `purge-asset-dryrun-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const assetKinds = [
    'ASSET_ACQUISITION','ASSET_DEPRECIATION_RESERVE','ASSET_DEPRECIATION_EXPENSE','ASSET_CLEARING','ASSET_DISPOSAL_GAIN','ASSET_DISPOSAL_LOSS'
  ];

  // find asset-related journal entries
  const assetJournalEntries = await prisma.journalEntry.findMany({ where: { companyId, sourceType: 'ASSET' }, select: { id: true, number: true } });
  const assetJournalIds = assetJournalEntries.map(j=>j.id);

  // find transactions by journalEntry or by kind
  const txnsByJE = assetJournalIds.length ? await prisma.transaction.findMany({ where: { companyId, journalEntryId: { in: assetJournalIds } }, select: { id: true } }) : [];
  const txnsByKind = await prisma.transaction.findMany({ where: { companyId, kind: { in: assetKinds } }, select: { id: true } });
  const txnsMap = new Map();
  for(const t of txnsByJE) txnsMap.set(t.id, t.id);
  for(const t of txnsByKind) txnsMap.set(t.id, t.id);
  const transactionIds = Array.from(txnsMap.keys());

  // depreciation lines, disposals, assets, categories
  const depreciationLines = await prisma.depreciationLine.findMany({ where: { companyId }, select: { id: true } });
  const depreciationLineIds = depreciationLines.map(d=>d.id);
  const disposals = await prisma.assetDisposal.findMany({ where: { companyId }, select: { id: true } });
  const disposalIds = disposals.map(d=>d.id);
  const assets = await prisma.asset.findMany({ where: { companyId }, select: { id: true } });
  const assetIds = assets.map(a=>a.id);
  const categories = await prisma.assetCategory.findMany({ where: { companyId }, select: { id: true } });
  const categoryIds = categories.map(c=>c.id);

  const report = {
    companyId,
    dryRun: !!dryRun,
    counts: {
      transactions: transactionIds.length,
      depreciationLines: depreciationLineIds.length,
      disposals: disposalIds.length,
      journalEntries: assetJournalIds.length,
      assets: assetIds.length,
      categories: categoryIds.length
    },
    ids: {
      transactionIds: transactionIds.slice(0,1000),
      depreciationLineIds: depreciationLineIds,
      disposalIds: disposalIds,
      assetJournalEntryIds: assetJournalIds,
      assetIds: assetIds,
      categoryIds: categoryIds
    }
  };

  fs.writeFileSync(path.join(outDir, 'purge-report.json'), safeStringify(report));
  console.log('Dry-run report written to', path.join(outDir, 'purge-report.json'));

  if(!dryRun){
    // perform deletion in safe order
    await prisma.$transaction(async (tx) => {
      if(transactionIds.length) await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });
      if(depreciationLineIds.length) await tx.depreciationLine.deleteMany({ where: { id: { in: depreciationLineIds } } });
      if(disposalIds.length) await tx.assetDisposal.deleteMany({ where: { id: { in: disposalIds } } });
      if(assetJournalIds.length) await deleteUnreferencedEmptyJournalsByIds(tx, assetJournalIds, companyId);
      if(assetIds.length) await tx.asset.deleteMany({ where: { id: { in: assetIds } } });
      if(categoryIds.length) await tx.assetCategory.deleteMany({ where: { id: { in: categoryIds } } });
    });
    console.log('Purge executed');
  } else {
    console.log('Dry-run only, no deletions performed');
  }

  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
