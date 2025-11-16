#!/usr/bin/env node
/**
 * Script: test-purchase-order-cancel.js
 * Objectif: Valider les règles d'annulation d'un Bon de Commande.
 * Cas couverts:
 *  1. Création BC (DRAFT) puis annulation directe -> statut CANCELLED.
 *  2. Création BC2 (DRAFT) -> approbation -> annulation (APPROVED sans réception) -> OK.
 *  3. Création BC3 -> approbation -> réception partielle -> tentative d'annulation doit échouer (409).
 *  4. Idempotence: annuler deux fois renvoie 409 la seconde avec message BC déjà cancelled.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function waitReady(maxTries=24, delayMs=500) {
  const debug = process.env.DEBUG_PO_CANCEL === '1';
  const candidates = [BASE + '/api/health', BASE + '/', BASE.replace('localhost','127.0.0.1') + '/api/health'];
  if (process.env.START_DEV_IF_DOWN === '1') {
    try {
      console.log('[INFO] START_DEV_IF_DOWN=1 -> tentative démarrage dev server');
      const { spawn } = await import('node:child_process');
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','dev'], {
        stdio: debug ? 'inherit' : 'ignore',
        shell: false,
        env: { ...process.env }
      });
      child.unref();
    } catch (e) {
      console.log('[WARN] Impossible de lancer automatiquement le dev server:', e.message);
    }
  }
  for (let i=1;i<=maxTries;i++) {
    for (const url of candidates) {
      try {
        const r = await fetch(url);
        if (r.ok) {
          if (i>1) console.log(`[INFO] Serveur prêt (tentative ${i}, ${url}).`); else console.log('[INFO] Serveur prêt.');
          return;
        } else if (debug) console.log('[DEBUG] Tentative', i, url, 'status=', r.status);
      } catch (e) { if (debug) console.log('[DEBUG] Tentative', i, url, 'erreur réseau:', e.message); }
    }
    if (i===1) console.log('[INFO] Attente disponibilité serveur...');
    await new Promise(r=>setTimeout(r, delayMs));
  }
  throw new Error('Serveur indisponible pour tests annulation (timeout readiness).');
}

async function jf(url, opts={}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type':'application/json', ...(opts.headers||{}) } });
  let data=null; try { data = await res.json(); } catch {}
  if (!res.ok) { const err = new Error(data?.error || res.status+ ' '+res.statusText); err.status=res.status; err.data=data; throw err; }
  return data;
}

function rand() { return Math.random().toString(36).slice(2,8); }

async function ensureSupplier() {
  const list = await jf(BASE+'/api/suppliers');
  if (list.suppliers?.length) return list.suppliers[0];
  return jf(BASE+'/api/suppliers', { method:'POST', body: JSON.stringify({ name: 'Fournisseur-'+rand() }) });
}

async function createProduct(label) {
  return jf(BASE+'/api/products', { method:'POST', body: JSON.stringify({ sku:'SKU-'+rand(), name:label, unit:'u' }) });
}

async function createPO(supplierId, prodA, prodB) {
  return jf(BASE+'/api/purchase-orders', { method:'POST', body: JSON.stringify({ supplierId, lines:[ { productId: prodA.id, orderedQty:'5', unitPrice:'10' }, { productId: prodB.id, orderedQty:'3', unitPrice:'20' } ] }) });
}

async function approve(po) { return jf(BASE+`/api/purchase-orders/${po.id}/approve`, { method:'POST' }); }
async function cancel(po) { return jf(BASE+`/api/purchase-orders/${po.id}/cancel`, { method:'POST' }); }
async function fetchPO(id) { return jf(BASE+`/api/purchase-orders/${id}`); }

async function receiptPartial(po, product) {
  // Lier à la ligne correspondante
  const refreshed = await fetchPO(po.id);
  const line = refreshed.lines.find(l=>l.productId===product.id);
  const body = { purchaseOrderId: po.id, lines:[ { productId: product.id, qtyReceived: 2, unitCost: 10, purchaseOrderLineId: line.id } ] };
  return jf(BASE+'/api/goods-receipts', { method:'POST', body: JSON.stringify(body) });
}

(async function main(){
  try {
    console.log('--- TEST PURCHASE ORDER CANCEL ---');
    await waitReady();
    const supplier = await ensureSupplier();
    const pA = await createProduct('Prod A');
    const pB = await createProduct('Prod B');

    // 1. DRAFT -> CANCEL
    const po1 = await createPO(supplier.id, pA, pB);
    if (po1.status !== 'DRAFT') throw new Error('po1 pas DRAFT');
    const cancelled1 = await cancel(po1);
    if (cancelled1.status !== 'CANCELLED') throw new Error('Annulation po1 échouée');
    console.log('[OK] Annulation DRAFT -> CANCELLED');
    // Deuxième tentative -> 409
    try { await cancel(po1); console.error('[FAIL] Double annulation devrait 409'); } catch(e){ if(e.status===409) console.log('[OK] Annulation répétée bloquée:', e.data?.error); else throw e; }

    // 2. APPROVED sans réception -> CANCEL
    const po2 = await createPO(supplier.id, pA, pB);
    await approve(po2);
    const po2Approved = await fetchPO(po2.id);
    if (po2Approved.status !== 'APPROVED') throw new Error('po2 non APPROVED après approve');
    const cancelled2 = await cancel(po2Approved);
    if (cancelled2.status !== 'CANCELLED') throw new Error('Annulation po2 échouée');
    console.log('[OK] Annulation APPROVED sans réception -> CANCELLED');

    // 3. APPROVED + réception partielle -> annulation interdite
    const po3 = await createPO(supplier.id, pA, pB);
    await approve(po3);
    await receiptPartial(po3, pA);
    const afterReceipt = await fetchPO(po3.id);
    if (afterReceipt.status !== 'PARTIAL') throw new Error('Statut attendu PARTIAL après réception partielle');
    try { await cancel(po3); console.error('[FAIL] Annulation après réception partielle devrait échouer'); } catch(e){ if(e.status===409) console.log('[OK] Annulation refusée après réception partielle:', e.data?.error); else throw e; }

    console.log('\n✅ Test annulation BC OK');
  } catch (e) {
    console.error('❌ Echec test annulation BC:', e.status, e.message, e.data||'');
    process.exit(1);
  }
})();
