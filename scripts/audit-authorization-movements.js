#!/usr/bin/env node
/**
 * Audit des mouvements issus d'autorisations de trésorerie.
 * Vérifie:
 *  - Chaque moneyMovement lié à une authorization possède >=1 transaction.
 *  - La ligne (ou les lignes) sur le compte de trésorerie reflètent le sens et le montant.
 *  - Pour les factures client: somme des mouvements IN = paidAmount et outstanding = total - paid.
 *  - Pour les factures fournisseur: somme des mouvements OUT = paidAmount et outstanding = total - paid.
 *  - Presence de voucherRef.
 * Affiche un rapport détaillé + récapitulatif.
 */
import prisma from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';

function decToNum(d) { if (d == null) return 0; if (typeof d === 'number') return d; if (d instanceof Prisma.Decimal) return Number(d.toString()); return Number(d); }

async function audit() {
  const issues = [];
  const authMovements = await prisma.moneyMovement.findMany({
    where: { authorizationId: { not: null } },
    include: {
      moneyAccount: { include: { ledgerAccount: true } },
      transactions: true,
      invoice: true,
      incomingInvoice: true,
      authorization: true
    }
  });
  console.log(`[audit] Mouvements liés à une autorisation: ${authMovements.length}`);
  for (const mv of authMovements) {
    const idShort = mv.id.slice(0,8);
    if (!mv.transactions.length) {
      issues.push({ type: 'NO_TRANSACTIONS', movementId: mv.id, authorizationId: mv.authorizationId });
      console.log(` - [NO_TRANSACTIONS] movement=${idShort} auth=${mv.authorizationId}`);
    }
    if (!mv.voucherRef) {
      issues.push({ type: 'NO_VOUCHER_REF', movementId: mv.id });
      console.log(` - [NO_VOUCHER_REF] movement=${idShort}`);
    }
    // Vérifier cohérence sens montant vs écritures sur le compte trésorerie
    if (mv.transactions.length && mv.moneyAccount?.ledgerAccountId) {
      const ledgerLines = mv.transactions.filter(t => t.accountId === mv.moneyAccount.ledgerAccountId);
      if (!ledgerLines.length) {
        issues.push({ type: 'MISSING_TREASURY_LINE', movementId: mv.id });
        console.log(` - [MISSING_TREASURY_LINE] movement=${idShort}`);
      } else {
        const sumDebit = ledgerLines.filter(l=>l.direction==='DEBIT').reduce((s,l)=>s+decToNum(l.amount),0);
        const sumCredit = ledgerLines.filter(l=>l.direction==='CREDIT').reduce((s,l)=>s+decToNum(l.amount),0);
        const expected = decToNum(mv.amount);
        if (mv.direction === 'IN') {
          if (Math.abs(sumDebit - expected) > 0.0001) {
            issues.push({ type: 'TREASURY_AMOUNT_MISMATCH', movementId: mv.id, expected, debit: sumDebit, credit: sumCredit });
            console.log(` - [TREASURY_AMOUNT_MISMATCH] movement=${idShort} expected debit=${expected} got debit=${sumDebit}`);
          }
        } else { // OUT
          if (Math.abs(sumCredit - expected) > 0.0001) {
            issues.push({ type: 'TREASURY_AMOUNT_MISMATCH', movementId: mv.id, expected, debit: sumDebit, credit: sumCredit });
            console.log(` - [TREASURY_AMOUNT_MISMATCH] movement=${idShort} expected credit=${expected} got credit=${sumCredit}`);
          }
        }
      }
    }
  }

  // Audit factures client
  const invoiceIds = [...new Set(authMovements.filter(m=>m.invoiceId).map(m=>m.invoiceId))];
  for (const invId of invoiceIds) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invId } });
    if (!invoice) continue;
    const paidAgg = await prisma.moneyMovement.aggregate({ where: { invoiceId: invId, direction: 'IN' }, _sum: { amount: true } });
    const paidCalc = paidAgg._sum.amount || new Prisma.Decimal(0);
    const paidStored = invoice.paidAmount;
    if (!paidCalc.eq(paidStored)) {
      issues.push({ type: 'INVOICE_PAID_MISMATCH', invoiceId: invId, calculated: paidCalc.toString(), stored: paidStored.toString() });
      console.log(` - [INVOICE_PAID_MISMATCH] invoice=${invId.slice(0,8)} calc=${paidCalc} stored=${paidStored}`);
    }
    const expectedOutstanding = invoice.totalAmount.minus(paidCalc);
    if (!expectedOutstanding.eq(invoice.outstandingAmount)) {
      issues.push({ type: 'INVOICE_OUTSTANDING_MISMATCH', invoiceId: invId, calculated: expectedOutstanding.toString(), stored: invoice.outstandingAmount.toString() });
      console.log(` - [INVOICE_OUTSTANDING_MISMATCH] invoice=${invId.slice(0,8)} calc=${expectedOutstanding} stored=${invoice.outstandingAmount}`);
    }
  }

  // Audit factures fournisseur
  const incIds = [...new Set(authMovements.filter(m=>m.incomingInvoiceId).map(m=>m.incomingInvoiceId))];
  for (const iid of incIds) {
    const inv = await prisma.incomingInvoice.findUnique({ where: { id: iid } });
    if (!inv) continue;
    const paidAgg = await prisma.moneyMovement.aggregate({ where: { incomingInvoiceId: iid, direction: 'OUT' }, _sum: { amount: true } });
    const paidCalc = paidAgg._sum.amount || new Prisma.Decimal(0);
    const paidStored = inv.paidAmount;
    if (!paidCalc.eq(paidStored)) {
      issues.push({ type: 'INCOMING_PAID_MISMATCH', incomingInvoiceId: iid, calculated: paidCalc.toString(), stored: paidStored.toString() });
      console.log(` - [INCOMING_PAID_MISMATCH] incoming=${iid.slice(0,8)} calc=${paidCalc} stored=${paidStored}`);
    }
    const expectedOutstanding = inv.totalAmount.minus(paidCalc);
    if (!expectedOutstanding.eq(inv.outstandingAmount)) {
      issues.push({ type: 'INCOMING_OUTSTANDING_MISMATCH', incomingInvoiceId: iid, calculated: expectedOutstanding.toString(), stored: inv.outstandingAmount.toString() });
      console.log(` - [INCOMING_OUTSTANDING_MISMATCH] incoming=${iid.slice(0,8)} calc=${expectedOutstanding} stored=${inv.outstandingAmount}`);
    }
  }

  console.log('\n=== RÉSUMÉ AUDIT AUTHORIZATIONS ===');
  const grouped = issues.reduce((acc,i)=>{ acc[i.type]=(acc[i.type]||0)+1; return acc; },{});
  Object.entries(grouped).forEach(([k,v])=> console.log(` - ${k}: ${v}`));
  console.log(`Total anomalies: ${issues.length}`);
  if (!issues.length) console.log('Aucune anomalie détectée ✓');
  if (issues.length) process.exitCode = 1;
}

audit().catch(e => { console.error(e); process.exit(1); });
