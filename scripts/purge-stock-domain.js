#!/usr/bin/env node
/**
 * Purge / réinitialisation du domaine Stock et extension optionnelle VENTES / ACHATS sans toucher au plan comptable.
 *
 * Modes stock:
 *   --basic :
 *      - Supprime tous les StockMovement
 *      - Supprime les transactions de type INVENTORY_ASSET / STOCK_VARIATION / PURCHASE_RETURN
 *      - Remet à zéro les agrégats ProductInventory (qtyOnHand/qtyStaged=0, avgCost=NULL)
 *      - Réinitialise les lignes d'inventaire (InventoryCountLine delta*) sans supprimer les comptages (optionnel)
 *   --full : (inclut basic + nettoyage des traces de réception / retour)
 *      - Supprime GoodsReceiptLine, GoodsReceipt
 *      - Supprime ReturnOrderLine, ReturnOrder
 *      - Met à zéro les quantités reçues/billed/returned sur PurchaseOrderLine
 *      - Supprime StockWithdrawalLine & StockWithdrawal
 *      - Supprime InventoryCountLine & InventoryCount
 *
 * Extensions:
 *   --sales :
 *      - Détache invoiceLines (salesOrderLineId -> null)
 *      - Supprime SalesOrderLine puis SalesOrder
 *   --purchases :
 *      - Supprime PurchaseOrderStatusLog & PurchaseOrder (après reset lignes si full)
 *      - Détache incomingInvoice.purchaseOrderId (null)
 *      - (Lignes déjà traitées dans modes stock)
 * Sécurité: Requiert --force OU STOCK_PURGE_CONFIRM=YES.
 *
 * Après purge recommander:
 *   1. Recalcul valorisation moyenne:  node scripts/revalue-inventory-cump.js
 *   2. Rebuild journal (si transactions supprimées):  node scripts/rebuild-journal.js
 *   3. Lancer audits: node scripts/audit-stock.js ; node scripts/audit-inventory-count.js
 *
 * Usage exemples:
 *   node scripts/purge-stock-domain.js --basic --force
 *   node scripts/purge-stock-domain.js --full --force
 *   STOCK_PURGE_CONFIRM=YES node scripts/purge-stock-domain.js --basic
 */
import prisma from '../src/lib/prisma.js';

const args = process.argv.slice(2);
const isFull = args.includes('--full');
const isBasic = args.includes('--basic') || (!isFull); // défaut basic si rien
const includeSales = args.includes('--sales');
const includePurchases = args.includes('--purchases');
const forced = args.includes('--force') || process.env.STOCK_PURGE_CONFIRM === 'YES';

if (!forced) {
  console.error('\n[ABORT] Confirmation manquante. Ajoutez --force ou STOCK_PURGE_CONFIRM=YES.');
  process.exit(1);
}

function opt(label, fn) {
  const start = Date.now();
  return fn().then(res => ({ label, ms: Date.now() - start, res })).catch(e => { throw new Error(label + ': ' + e.message); });
}

async function basicPhase() {
  const steps = [];
  // Supprimer mouvements stock avant agrégats.
  steps.push(await opt('stockMovement.deleteMany', () => prisma.stockMovement.deleteMany()));
  // Transactions inventaire (impactent journal)
  steps.push(
    await opt(
      'transaction.deleteMany(inventoryKinds)',
      () =>
        prisma.transaction.deleteMany({
          where: {
            kind: {
              in: [
                'INVENTORY_ASSET',
                'STOCK_VARIATION',
                'PURCHASE_RETURN'
              ],
            },
          },
        })
    )
  );
  // Remise à zéro ProductInventory
  const invReset = await prisma.productInventory.updateMany({ data:{ qtyOnHand: '0', qtyStaged: '0', avgCost: null } });
  steps.push({ label:'productInventory.updateMany(reset)', ms:0, res:invReset });
  // Neutraliser deltas sur InventoryCountLine (sans supprimer si pas full)
  const icl = await prisma.inventoryCountLine.updateMany({ data:{ deltaQty:null, deltaValue:null } });
  steps.push({ label:'inventoryCountLine.updateMany(delta cleared)', ms:0, res:icl });
  return steps;
}

async function fullPhase() {
  const steps = [];
  // Lignes & documents réception
  steps.push(await opt('goodsReceiptLine.deleteMany', () => prisma.goodsReceiptLine.deleteMany()));
  steps.push(await opt('goodsReceipt.deleteMany', () => prisma.goodsReceipt.deleteMany()));
  // Lignes & documents retour
  steps.push(await opt('returnOrderLine.deleteMany', () => prisma.returnOrderLine.deleteMany()));
  steps.push(await opt('returnOrder.deleteMany', () => prisma.returnOrder.deleteMany()));
  // Stock withdrawals
  steps.push(await opt('stockWithdrawalLine.deleteMany', () => prisma.stockWithdrawalLine.deleteMany()));
  steps.push(await opt('stockWithdrawal.deleteMany', () => prisma.stockWithdrawal.deleteMany()));
  // Inventaires (counts)
  steps.push(await opt('inventoryCountLine.deleteMany', () => prisma.inventoryCountLine.deleteMany()));
  steps.push(await opt('inventoryCount.deleteMany', () => prisma.inventoryCount.deleteMany()));
  // Réinitialiser PO lines quantités reçues/billed/returned
  const poUpd = await prisma.purchaseOrderLine.updateMany({ data:{ receivedQty:0, billedQty:0, returnedQty:0 } });
  steps.push({ label:'purchaseOrderLine.updateMany(qties reset)', ms:0, res:poUpd });
  return steps;
}

async function salesPhase() {
  const steps = [];
  // Détacher les invoiceLines liées aux SalesOrderLine pour éviter FK errors.
  steps.push(await opt('invoiceLine.updateMany(detach salesOrderLineId)', () => prisma.invoiceLine.updateMany({ data:{ salesOrderLineId: null } })));
  // Supprimer SalesOrderLine puis SalesOrder
  steps.push(await opt('salesOrderLine.deleteMany', () => prisma.salesOrderLine.deleteMany()));
  steps.push(await opt('salesOrder.deleteMany', () => prisma.salesOrder.deleteMany()));
  return steps;
}

async function purchasesPhase() {
  const steps = [];
  // Détacher incomingInvoice.purchaseOrderId pour éviter FK si on supprime les PO
  steps.push(await opt('incomingInvoice.updateMany(detach purchaseOrderId)', () => prisma.incomingInvoice.updateMany({ data:{ purchaseOrderId: null } })));
  // Supprimer status logs puis purchase orders
  steps.push(await opt('purchaseOrderStatusLog.deleteMany', () => prisma.purchaseOrderStatusLog.deleteMany()));
  steps.push(await opt('purchaseOrder.deleteMany', () => prisma.purchaseOrder.deleteMany()));
  return steps;
}

async function main() {
  const mode = isFull ? 'FULL' : 'BASIC';
  console.log(`\n=== PURGE STOCK (${mode}) DÉMARRÉ ===`);
  const allSteps = [];
  if (isBasic) {
    allSteps.push(...await basicPhase());
  }
  if (isFull) {
    allSteps.push(...await fullPhase());
  }
  if (includeSales) {
    allSteps.push(...await salesPhase());
  }
  if (includePurchases) {
    allSteps.push(...await purchasesPhase());
  }
  console.log('\nRésumé opérations:');
  for (const s of allSteps) {
    const c = s.res?.count ?? '?';
    console.log(` - ${s.label} => ${c}`);
  }
  console.log('\n=== PURGE STOCK TERMINÉ ===');
  console.log('\nActions recommandées:');
  console.log('  1. node scripts/revalue-inventory-cump.js');
  console.log('  2. node scripts/rebuild-journal.js');
  console.log('  3. node scripts/audit-stock.js');
  console.log('  4. node scripts/audit-inventory-count.js');
  if (includeSales) console.log('  5. Vérifier cohérence factures: node scripts/analyze-invoice-numbers.js');
  if (includePurchases) console.log('  6. Audit fournisseurs: node scripts/audit-supplier-payments.js');
  console.log('\nReprise possible des opérations de commandes / réceptions / ventes.');
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('Erreur purge stock:', e);
  await prisma.$disconnect();
  process.exit(1);
});
