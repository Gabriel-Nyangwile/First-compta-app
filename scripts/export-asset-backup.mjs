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
  if(!companyId) { console.error('DEFAULT_COMPANY_ID required'); process.exit(1); }

  const outDir = path.resolve('backups', `asset-backup-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Exporting assets for company', companyId);

  const assetCategories = await prisma.assetCategory.findMany({ where: { companyId } });
  fs.writeFileSync(path.join(outDir, 'assetCategories.json'), safeStringify(assetCategories));

  const assets = await prisma.asset.findMany({ where: { companyId } });
  fs.writeFileSync(path.join(outDir, 'assets.json'), safeStringify(assets));

  const depLines = await prisma.depreciationLine.findMany({ where: { companyId } });
  fs.writeFileSync(path.join(outDir, 'depreciationLines.json'), safeStringify(depLines));

  const disposals = await prisma.assetDisposal.findMany({ where: { companyId } });
  fs.writeFileSync(path.join(outDir, 'assetDisposals.json'), safeStringify(disposals));

  // JournalEntries with sourceType ASSET
  const assetJournalEntries = await prisma.journalEntry.findMany({ where: { companyId, sourceType: 'ASSET' } });
  fs.writeFileSync(path.join(outDir, 'assetJournalEntries.json'), safeStringify(assetJournalEntries));

  // Transactions linked to assets: either journalEntryId in above OR kind in asset-related kinds
  const assetJournalIds = assetJournalEntries.map(j => j.id);
  const assetKinds = [
    'ASSET_ACQUISITION','ASSET_DEPRECIATION_RESERVE','ASSET_DEPRECIATION_EXPENSE','ASSET_CLEARING','ASSET_DISPOSAL_GAIN','ASSET_DISPOSAL_LOSS'
  ];

  const txnsByJE = assetJournalIds.length ? await prisma.transaction.findMany({ where: { companyId, journalEntryId: { in: assetJournalIds } } }) : [];
  const txnsByKind = await prisma.transaction.findMany({ where: { companyId, kind: { in: assetKinds } } });

  // merge unique
  const map = new Map();
  for(const t of txnsByJE) map.set(t.id, t);
  for(const t of txnsByKind) map.set(t.id, t);
  const txns = Array.from(map.values());
  fs.writeFileSync(path.join(outDir, 'assetTransactions.json'), safeStringify(txns));

  console.log('Export complete:', outDir);
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
