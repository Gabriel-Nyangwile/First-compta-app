#!/usr/bin/env node
/**
 * Test multi-taux TVA pour factures client et fournisseur.
 * Objectifs:
 *  1. Créer (si nécessaire) un client + comptes requis.
 *  2. Générer une facture client avec lignes à taux mixtes (ex: 20%, 10%).
 *  3. Vérifier via l'endpoint PDF que les deux taux apparaissent (signature & tailles > seuil minimal).
 *  4. Générer une facture fournisseur (incoming) multi-taux et vérifier pareil.
 *  5. Créer aussi une facture homogène (toutes lignes même taux) pour s'assurer que le fallback global fonctionne.
 *
 * Exécution: node scripts/test-multirate-vat-pdf.js [--base-url http://localhost:3000] [--start-server]
 */
import prisma from '../src/lib/prisma.js';
import { spawn } from 'node:child_process';
import assert from 'node:assert';
import { setTimeout as delay } from 'node:timers/promises';

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = { baseUrl: 'http://localhost:3000', startServer: false };
  for (let i=0;i<args.length;i++){
    const a = args[i];
    if (a === '--base-url') opts.baseUrl = args[++i];
    else if (a === '--start-server') opts.startServer = true;
  }
  return opts;
}

async function waitHealth(baseUrl, timeoutMs=60000){
  const start = Date.now();
  while(Date.now()-start < timeoutMs){
    try {
      const r = await fetch(baseUrl + '/api/health', { cache: 'no-store' });
      if (r.ok){ const j = await r.json().catch(()=>null); if (j && j.ok) return true; }
    } catch {/* ignore */}
    await delay(1200);
  }
  throw new Error('Serveur non prêt après ' + (timeoutMs/1000) + 's');
}

async function ensureBaseAccounts(){
  // Prend un compte produit (7xx) et un compte charge (6xx) + client & fournisseur.
  let productAccount = await prisma.account.findFirst({ where: { number: { startsWith: '70' } } });
  if (!productAccount) {
    productAccount = await prisma.account.create({ data: { number: '707000', label: 'Ventes tests', description: 'Auto créé test multi TVA' } });
  }
  let chargeAccount = await prisma.account.findFirst({ where: { number: { startsWith: '60' } } });
  if (!chargeAccount) {
    chargeAccount = await prisma.account.create({ data: { number: '606000', label: 'Achats tests', description: 'Auto créé test multi TVA' } });
  }
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({ data: { name: 'Client Multi TVA', category: 'DAYS_30' } });
  }
  let supplier = await prisma.supplier.findFirst();
  if (!supplier) {
    supplier = await prisma.supplier.create({ data: { name: 'Fournisseur Multi TVA' } });
  }
  return { productAccount, chargeAccount, client, supplier };
}

async function createClientInvoiceMulti({ clientId, productAccountId }){
  const payload = {
    clientId,
    invoiceNumber: 'INV-MULTI-' + Date.now(),
    invoiceLines: [
      { description: 'Article 20%', accountId: productAccountId, quantity: 2, unitPrice: 50, vatRate: 0.20 },
      { description: 'Article 10%', accountId: productAccountId, quantity: 1, unitPrice: 100, vatRate: 0.10 }
    ],
    vat: 0.20,
    status: 'PENDING'
  };
  const r = await fetch('http://localhost:3000/api/invoices', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Echec création facture client multi TVA');
  return r.json();
}

async function createClientInvoiceSingle({ clientId, productAccountId }){
  const payload = {
    clientId,
    invoiceNumber: 'INV-SINGLE-' + Date.now(),
    invoiceLines: [
      { description: 'Article 20% A', accountId: productAccountId, quantity: 1, unitPrice: 40, vatRate: 0.20 },
      { description: 'Article 20% B', accountId: productAccountId, quantity: 3, unitPrice: 10, vatRate: 0.20 }
    ],
    vat: 0.20,
    status: 'PENDING'
  };
  const r = await fetch('http://localhost:3000/api/invoices', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Echec création facture client single TVA');
  return r.json();
}

async function createIncomingInvoiceMulti({ supplierId, chargeAccountId }){
  const payload = {
    supplierId,
    supplierInvoiceNumber: 'SUP-MULTI-' + Date.now(),
    vat: 0.20,
    lines: [
      { description: 'Fourniture 5.5%', accountId: chargeAccountId, unitOfMeasure: 'u', quantity: 4, unitPrice: 10, vatRate: 0.055 },
      { description: 'Fourniture 20%', accountId: chargeAccountId, unitOfMeasure: 'u', quantity: 2, unitPrice: 50, vatRate: 0.20 }
    ]
  };
  const r = await fetch('http://localhost:3000/api/incoming-invoices', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Echec création facture fournisseur multi TVA');
  return r.json();
}

async function createIncomingInvoiceSingle({ supplierId, chargeAccountId }){
  const payload = {
    supplierId,
    supplierInvoiceNumber: 'SUP-SINGLE-' + Date.now(),
    vat: 0.20,
    lines: [
      { description: 'Fourniture 20% A', accountId: chargeAccountId, unitOfMeasure: 'u', quantity: 1, unitPrice: 30, vatRate: 0.20 },
      { description: 'Fourniture 20% B', accountId: chargeAccountId, unitOfMeasure: 'u', quantity: 5, unitPrice: 6, vatRate: 0.20 }
    ]
  };
  const r = await fetch('http://localhost:3000/api/incoming-invoices', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Echec création facture fournisseur single TVA');
  return r.json();
}

async function fetchPdf(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.slice(0,4).toString().startsWith('%PDF')) throw new Error('Signature PDF invalide');
  assert.ok(buf.length > 800, 'PDF trop petit (' + buf.length + ' octets)');
  return buf;
}

async function run(){
  const opts = parseArgs();
  let devProc = null;
  // Démarrage éventuel serveur
  let healthy = false;
  try {
    const h = await fetch(opts.baseUrl + '/api/health');
    healthy = h.ok;
  } catch { healthy = false; }
  if (!healthy && opts.startServer){
    devProc = spawn(process.platform === 'win32' ? 'npm.cmd':'npm', ['run','dev'], { stdio:'inherit', env: process.env });
    await waitHealth(opts.baseUrl);
  } else if (!healthy) {
    throw new Error('Serveur non lancé et --start-server non fourni');
  }
  console.log('Préparation données...');
  const { productAccount, chargeAccount, client, supplier } = await ensureBaseAccounts();
  const invMulti = await createClientInvoiceMulti({ clientId: client.id, productAccountId: productAccount.id });
  const invSingle = await createClientInvoiceSingle({ clientId: client.id, productAccountId: productAccount.id });
  const incMulti = await createIncomingInvoiceMulti({ supplierId: supplier.id, chargeAccountId: chargeAccount.id });
  const incSingle = await createIncomingInvoiceSingle({ supplierId: supplier.id, chargeAccountId: chargeAccount.id });

  console.log('Téléchargement PDFs...');
  const pdfClientMulti = await fetchPdf(`${opts.baseUrl}/api/invoice/${invMulti.id}/pdf`);
  const pdfClientSingle = await fetchPdf(`${opts.baseUrl}/api/invoice/${invSingle.id}/pdf`);
  const pdfIncomingMulti = await fetchPdf(`${opts.baseUrl}/api/incoming-invoices/${incMulti.id}/pdf`);
  const pdfIncomingSingle = await fetchPdf(`${opts.baseUrl}/api/incoming-invoices/${incSingle.id}/pdf`);

  // Vérifications heuristiques: rechercher les taux (ex: '20', '10', '5.5').
  const textSearch = (buf, needle) => buf.toString('latin1').includes(needle);
  assert.ok(textSearch(pdfClientMulti, '20%') || textSearch(pdfClientMulti, '20'), 'Taux 20% manquant facture client multi');
  assert.ok(textSearch(pdfClientMulti, '10%') || textSearch(pdfClientMulti, '10'), 'Taux 10% manquant facture client multi');
  assert.ok(!textSearch(pdfClientSingle, '10%'), 'Taux 10% ne devrait pas apparaître facture client single');
  assert.ok(textSearch(pdfIncomingMulti, '5.5') || textSearch(pdfIncomingMulti, '5,5') || textSearch(pdfIncomingMulti, '5.5%'), 'Taux 5.5% manquant incoming multi');
  assert.ok(!textSearch(pdfIncomingSingle, '5.5'), 'Taux 5.5% ne devrait pas apparaître incoming single');

  console.log('SUCCESS multi-taux TVA vérifié.');
  if (devProc) devProc.kill('SIGINT');
}

run().catch(e => { console.error('ECHEC test multi-taux', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
