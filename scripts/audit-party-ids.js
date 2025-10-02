#!/usr/bin/env node
/**
 * Audit des transactions orphelines (supplierId/clientId manquants) après backfill.
 *
 * Usage:
 *   node scripts/audit-party-ids.js [--fix] [--limit 20] [--json]
 *
 * --fix  : applique la correction (comme le script backfill) pour celles qui sont inférables.
 * --limit: nombre d'exemples à afficher dans le rapport (défaut 10).
 * --json : sortie JSON structurée (utile CI / automatisation).
 */
import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const asJson = args.includes('--json');
const limitArg = (() => {
  const idx = args.indexOf('--limit');
  if (idx >= 0 && args[idx+1]) { const n = parseInt(args[idx+1],10); if (!isNaN(n) && n>0) return n; }
  return 10;
})();

function out(obj){
  if (asJson) return; else console.log('[audit-party-ids]', ...obj);
}

async function collect() {
  const supplierOrphans = await prisma.transaction.findMany({
    where: { supplierId: null, incomingInvoiceId: { not: null } },
    select: { id: true, incomingInvoiceId: true, incomingInvoice: { select: { supplierId: true, entryNumber: true } } }
  });
  const clientOrphans = await prisma.transaction.findMany({
    where: { clientId: null, invoiceId: { not: null } },
    select: { id: true, invoiceId: true, invoice: { select: { clientId: true, invoiceNumber: true } } }
  });

  return { supplierOrphans, clientOrphans };
}

async function applyFix(orphanList, type) {
  let updated = 0;
  const BATCH = 200;
  const updates = [];
  if (type === 'supplier') {
    for (const t of orphanList) if (t.incomingInvoice?.supplierId) updates.push({ id: t.id, supplierId: t.incomingInvoice.supplierId });
    for (let i=0;i<updates.length;i+=BATCH) {
      const slice = updates.slice(i,i+BATCH);
      await prisma.$transaction(slice.map(u => prisma.transaction.update({ where: { id: u.id }, data: { supplierId: u.supplierId } })));
      updated += slice.length;
    }
  } else {
    for (const t of orphanList) if (t.invoice?.clientId) updates.push({ id: t.id, clientId: t.invoice.clientId });
    for (let i=0;i<updates.length;i+=BATCH) {
      const slice = updates.slice(i,i+BATCH);
      await prisma.$transaction(slice.map(u => prisma.transaction.update({ where: { id: u.id }, data: { clientId: u.clientId } })));
      updated += slice.length;
    }
  }
  return updated;
}

async function main() {
  const { supplierOrphans, clientOrphans } = await collect();

  if (fix) {
    const supFixed = await applyFix(supplierOrphans, 'supplier');
    const cliFixed = await applyFix(clientOrphans, 'client');
    // Recollect après fix pour rapport final
    const after = await collect();
    const report = {
      fixed: { supplier: supFixed, client: cliFixed },
      remaining: { supplier: after.supplierOrphans.length, client: after.clientOrphans.length }
    };
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      out(['Fix applied. Supplier fixed:', supFixed, 'Client fixed:', cliFixed]);
      out(['Remaining supplier orphans:', report.remaining.supplier]);
      out(['Remaining client orphans:', report.remaining.client]);
    }
    process.exit(0);
  }

  // Rapport lecture seule
  const report = {
    supplier: {
      count: supplierOrphans.length,
      examples: supplierOrphans.slice(0, limitArg).map(t => ({ id: t.id, incomingInvoiceId: t.incomingInvoiceId, inferredSupplierId: t.incomingInvoice?.supplierId || null }))
    },
    client: {
      count: clientOrphans.length,
      examples: clientOrphans.slice(0, limitArg).map(t => ({ id: t.id, invoiceId: t.invoiceId, inferredClientId: t.invoice?.clientId || null }))
    }
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    out(['Supplier orphans:', report.supplier.count]);
    for (const ex of report.supplier.examples) out(['  example', ex.id, 'invoiceIn=', ex.incomingInvoiceId, 'inferred=', ex.inferredSupplierId]);
    out(['Client orphans:', report.client.count]);
    for (const ex of report.client.examples) out(['  example', ex.id, 'invoice=', ex.invoiceId, 'inferred=', ex.inferredClientId]);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
