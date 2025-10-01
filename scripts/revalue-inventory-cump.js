#!/usr/bin/env node
import { revalueProducts } from '../src/lib/revalueInventory.js';

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  let productIds = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--product' && args[i+1]) productIds.push(args[i+1]);
  }
  if (!productIds.length) productIds = null;
  const res = await revalueProducts({ productIds, strict });
  console.table(res.map(r => ({ sku: r.sku, qty: r.qtyOnHand, avg: r.avgCost, updates: r.updatedMovements, warnings: r.warnings.length })));
  const totalUpdates = res.reduce((a,b)=>a+b.updatedMovements,0);
  console.log(`Revalorisation terminée. Mouvements modifiés: ${totalUpdates}`);
}

main().catch(e => { console.error('Erreur revalorisation:', e); process.exit(1); });
