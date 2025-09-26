#!/usr/bin/env node
/*
  backfill-vat-multirate-add-only.js
  Mode: AJOUT SEULEMENT
  - Ne supprime aucune écriture existante (y compris l'ancienne écriture TVA agrégée)
  - Ajoute une écriture VAT_COLLECTED / VAT_DEDUCTIBLE par taux manquant
  - N'ajuste pas les totaux de facture (audit seulement)
  - Ajoute un tag dans description: "(backfill)" pour traçabilité

  Arguments:
    --dry      : ne fait que simuler (par défaut false)
    --limit N  : limite le nombre de factures traitées par type
    --verbose  : log détaillé

  Sécurité:
    Pas de modification destructive; idéal première passe.
*/
import prisma from '../src/lib/prisma.js';
import { getSystemAccounts } from '../src/lib/systemAccounts.js';

const args = process.argv.slice(2);
const flags = { dry:false, limit:null, verbose:false };
for (let i=0;i<args.length;i++) {
  if (args[i]==='--dry') flags.dry = true;
  else if (args[i]==='--verbose') flags.verbose = true;
  else if (args[i]==='--limit' && args[i+1]) { flags.limit = parseInt(args[++i],10); }
}

function num(v){return Number(v)||0;}
function pctStr(rate){return (rate*100).toFixed(2).replace(/\.00$/,'');}

async function backfillClientInvoices(vatAccount){
  const invoices = await prisma.invoice.findMany({
    take: flags.limit || undefined,
    include: { invoiceLines:true, transactions:true }
  });
  let added=0, skipped=0;
  for (const inv of invoices) {
    // Construire buckets à partir des lignes
    const buckets = new Map();
    for (const l of inv.invoiceLines) {
      const rate = l.vatRate != null ? num(l.vatRate) : num(inv.vat);
      const base = num(l.lineTotal); if (!buckets.has(rate)) buckets.set(rate,{base:0,vat:0});
      const b = buckets.get(rate); b.base += base; b.vat += base*rate;
    }
    if (!buckets.size) { if(flags.verbose) console.log(`CLIENT ${inv.invoiceNumber} sans lignes TVA`); skipped++; continue; }
    // Transactions TVA déjà présentes par taux?
    const existing = inv.transactions.filter(t=>t.kind==='VAT_COLLECTED');
    const existingByRate = new Set();
    for (const t of existing) {
      const m = t.description?.match(/TVA\s+(\d+(?:[.,]\d+)?)%/i); if(m){ existingByRate.add( (Number(m[1].replace(',','.'))/100).toFixed(2) ); }
    }
    const toAdd = [];
    for (const [rate, bucket] of buckets.entries()) {
      const key = rate.toFixed(2);
      if (existingByRate.has(key)) continue; // déjà une écriture multi-taux
      if (bucket.vat <= 0) continue;
      toAdd.push({ rate, vat: bucket.vat });
    }
    if (!toAdd.length) { skipped++; continue; }
    if (flags.verbose) console.log(`CLIENT ${inv.invoiceNumber}: ajout ${toAdd.length} écriture(s) TVA manquante(s)`);
    if (!flags.dry) {
      for (const item of toAdd) {
        await prisma.transaction.create({
          data: {
            nature: 'receipt',
            description: `TVA ${pctStr(item.rate)}% facture ${inv.invoiceNumber} (backfill)`,
            amount: item.vat.toFixed(2),
            direction: 'CREDIT',
            kind: 'VAT_COLLECTED',
            accountId: vatAccount.id,
            invoiceId: inv.id,
            clientId: inv.clientId || undefined
          }
        });
      }
    }
    added += toAdd.length;
  }
  return { added, skipped };
}

async function backfillSupplierInvoices(vatDeductibleAccount){
  const invoices = await prisma.incomingInvoice.findMany({
    take: flags.limit || undefined,
    include: { lines:true, transactions:true }
  });
  let added=0, skipped=0;
  for (const inv of invoices) {
    const buckets = new Map();
    for (const l of inv.lines) {
      const rate = l.vatRate != null ? num(l.vatRate) : num(inv.vat);
      const base = num(l.lineTotal); if(!buckets.has(rate)) buckets.set(rate,{base:0,vat:0});
      const b = buckets.get(rate); b.base += base; b.vat += base*rate;
    }
    if (!buckets.size) { skipped++; continue; }
    const existing = inv.transactions.filter(t=>t.kind==='VAT_DEDUCTIBLE');
    const existingByRate = new Set();
    for (const t of existing) {
      const m = t.description?.match(/TVA\s+déductible\s+(\d+(?:[.,]\d+)?)%/i); if(m){ existingByRate.add( (Number(m[1].replace(',','.'))/100).toFixed(2) ); }
    }
    const toAdd = [];
    for (const [rate,bucket] of buckets.entries()) {
      const key = rate.toFixed(2);
      if (existingByRate.has(key)) continue;
      if (bucket.vat <= 0) continue;
      toAdd.push({ rate, vat: bucket.vat });
    }
    if (!toAdd.length) { skipped++; continue; }
    if (flags.verbose) console.log(`SUPPLIER ${inv.entryNumber}: ajout ${toAdd.length} écriture(s) TVA déductible manquante(s)`);
    if (!flags.dry) {
      for (const item of toAdd) {
        await prisma.transaction.create({
          data: {
            nature: 'purchase',
            description: `TVA déductible ${pctStr(item.rate)}% facture ${inv.entryNumber} (backfill)`,
            amount: item.vat.toFixed(2),
            direction: 'DEBIT',
            kind: 'VAT_DEDUCTIBLE',
            accountId: vatDeductibleAccount.id,
            incomingInvoiceId: inv.id,
            supplierId: inv.supplierId || undefined
          }
        });
      }
    }
    added += toAdd.length;
  }
  return { added, skipped };
}

(async () => {
  try {
    const { vatAccount, vatDeductibleAccount } = await getSystemAccounts();
    const clientRes = await backfillClientInvoices(vatAccount);
    const supplierRes = await backfillSupplierInvoices(vatDeductibleAccount);
    console.log(`Client invoices: added=${clientRes.added} skipped=${clientRes.skipped}`);
    console.log(`Supplier invoices: added=${supplierRes.added} skipped=${supplierRes.skipped}`);
    if (flags.dry) console.log('Mode DRY: aucune écriture réellement créée.');
  } catch (e) {
    console.error('Erreur backfill:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
