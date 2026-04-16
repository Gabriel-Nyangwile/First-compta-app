#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

function safeStringify(obj){
  return JSON.stringify(obj, (k,v)=>{
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return v.toString();
    return v;
  }, 2);
}

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  if(!companyId){ console.error('DEFAULT_COMPANY_ID requis'); process.exit(1); }

  const outDir = path.resolve('backups', `asset-listing-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const categories = await prisma.assetCategory.findMany({ where: { companyId }, select: { id: true, code: true } });
  const assets = await prisma.asset.findMany({ where: { companyId }, select: { id: true, ref: true, meta: true } });
  const depLines = await prisma.depreciationLine.findMany({ where: { companyId }, select: { id: true, assetId: true, year: true, month: true } });
  const disposals = await prisma.assetDisposal.findMany({ where: { companyId }, select: { id: true, assetId: true, date: true } });
  const assetJEs = await prisma.journalEntry.findMany({ where: { companyId, sourceType: 'ASSET' }, select: { id: true, number: true, date: true } });

  const assetJEIds = assetJEs.map(j=>j.id);
  const assetKinds = [
    'ASSET_ACQUISITION','ASSET_DEPRECIATION_RESERVE','ASSET_DEPRECIATION_EXPENSE','ASSET_CLEARING','ASSET_DISPOSAL_GAIN','ASSET_DISPOSAL_LOSS'
  ];

  const txnsByJE = assetJEIds.length ? await prisma.transaction.findMany({ where: { companyId, journalEntryId: { in: assetJEIds } }, select: { id: true, journalEntryId: true } }) : [];
  const txnsByKind = await prisma.transaction.findMany({ where: { companyId, kind: { in: assetKinds } }, select: { id: true, kind: true } });

  const txnsMap = new Map();
  for(const t of txnsByJE) txnsMap.set(t.id, t);
  for(const t of txnsByKind) txnsMap.set(t.id, t);
  const txns = Array.from(txnsMap.values());

  const report = {
    companyId,
    counts: {
      assetCategories: categories.length,
      assets: assets.length,
      depreciationLines: depLines.length,
      assetDisposals: disposals.length,
      assetJournalEntries: assetJEs.length,
      assetTransactions: txns.length
    },
    samples: {
      assetCategories: categories.slice(0,10),
      assets: assets.slice(0,10),
      depreciationLines: depLines.slice(0,10),
      assetDisposals: disposals.slice(0,10),
      assetJournalEntries: assetJEs.slice(0,10),
      assetTransactions: txns.slice(0,20)
    },
    ids: {
      assetCategoryIds: categories.map(c=>c.id),
      assetIds: assets.map(a=>a.id),
      depreciationLineIds: depLines.map(d=>d.id),
      assetDisposalIds: disposals.map(d=>d.id),
      assetJournalEntryIds: assetJEIds,
      assetTransactionIds: txns.map(t=>t.id)
    }
  };

  const outFile = path.join(outDir, 'asset-listing-report.json');
  fs.writeFileSync(outFile, safeStringify(report));
  console.log('Dry-run listing written to', outFile);
  console.log('Counts:', report.counts);

  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
