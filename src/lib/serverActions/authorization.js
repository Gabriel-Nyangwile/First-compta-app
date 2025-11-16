import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';
import { autoPostTransactions, updateInvoiceSettlementStatus, updateIncomingInvoiceSettlementStatus, ensureLedgerAccountForMoneyAccount } from './money.js';

/** Utility: generate a simple docNumber. Real sequencing can replace later. */
function generateDocNumber(docType) {
  const ts = new Date();
  const y = ts.getFullYear();
  const pad = (n) => String(n).padStart(2,'0');
  return `${docType}-${y}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${ts.getTime().toString().slice(-5)}`;
}

export async function createAuthorization({ docType, scope, flow, amount, currency='EUR', beneficiaryType, beneficiaryAccountId, invoiceId, incomingInvoiceId, purpose, instrumentType, instrumentRef, issueDate }) {
  if (!docType) throw new Error('docType requis');
  if (!amount || Number(amount) <= 0) throw new Error('Montant > 0 requis');

  const normalizedDocType = String(docType).toUpperCase();
  let resolvedScope;
  let resolvedFlow;

  switch (normalizedDocType) {
    case 'PCD':
      resolvedScope = 'CASH';
      resolvedFlow = 'OUT';
      break;
    case 'PCR':
      resolvedScope = 'CASH';
      resolvedFlow = 'IN';
      break;
    case 'OP':
      resolvedScope = 'BANK';
      if (flow && flow !== 'IN' && flow !== 'OUT') {
        throw new Error('flow OP doit etre IN ou OUT');
      }
      resolvedFlow = flow || 'OUT';
      break;
    default:
      throw new Error('docType inconnu (attendu: PCD, PCR, OP)');
  }

  if (scope && scope !== resolvedScope) {
    throw new Error(`docType ${normalizedDocType} impose scope ${resolvedScope}`);
  }
  if (normalizedDocType !== 'OP' && flow && flow !== resolvedFlow) {
    throw new Error(`docType ${normalizedDocType} impose flow ${resolvedFlow}`);
  }

  const docNumber = generateDocNumber(normalizedDocType);
  return prisma.treasuryAuthorization.create({
    data: {
      docType: normalizedDocType,
      scope: resolvedScope,
      flow: resolvedFlow,
      amount: new Prisma.Decimal(amount),
      currency,
      beneficiaryType: beneficiaryType || null,
      beneficiaryAccountId: beneficiaryAccountId || null,
      invoiceId: invoiceId || null,
      incomingInvoiceId: incomingInvoiceId || null,
      purpose: purpose || null,
      instrumentType: instrumentType || null,
      instrumentRef: instrumentRef || null,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      docNumber
    }
  });
}

export async function authorizeAuthorization(id) {
  return prisma.$transaction(async (tx) => {
    const auth = await tx.treasuryAuthorization.findUnique({ where: { id } });
    if (!auth) throw new Error('Authorization introuvable');
    if (auth.status !== 'DRAFT') throw new Error('Seulement DRAFT -> APPROVED');
    return tx.treasuryAuthorization.update({ where: { id }, data: { status: 'APPROVED' } });
  });
}

export async function cancelAuthorization(id) {
  return prisma.$transaction(async (tx) => {
    const auth = await tx.treasuryAuthorization.findUnique({ where: { id } });
    if (!auth) throw new Error('Authorization introuvable');
    if (auth.status === 'EXECUTED') throw new Error('Impossible d\'annuler EXECUTED');
    if (auth.status === 'CANCELLED') return auth; // idempotent
    return tx.treasuryAuthorization.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  });
}

/** Create a movement executing an APPROVED authorization. */
export async function executeAuthorizationViaMovement({ authorizationId, moneyAccountId, description }) {
  return prisma.$transaction(async (tx) => {
    const auth = await tx.treasuryAuthorization.findUnique({ where: { id: authorizationId } });
    if (!auth) throw new Error('Authorization introuvable');
    if (auth.status !== 'APPROVED') throw new Error('Authorization non APPROVED');
    // Create movement
    const voucherRef = `AUT-${auth.docNumber}`;
    const moneyAccount = await tx.moneyAccount.findUnique({ where: { id: moneyAccountId }, include: { ledgerAccount: true } });
    if (!moneyAccount) throw new Error('Compte trésorerie introuvable');
    if (!moneyAccount.ledgerAccountId) {
      const { account: createdLedger } = await ensureLedgerAccountForMoneyAccount(moneyAccount);
      moneyAccount.ledgerAccountId = createdLedger.id;
      moneyAccount.ledgerAccount = createdLedger;
    }
    const movement = await tx.moneyMovement.create({
      data: {
        moneyAccountId,
        amount: auth.amount,
        direction: auth.flow === 'IN' ? 'IN' : 'OUT',
        kind: deriveKindFromAuthorization(auth),
        authorizationId: auth.id,
        invoiceId: auth.invoiceId || null,
        incomingInvoiceId: auth.incomingInvoiceId || null,
        description: description || auth.purpose || auth.docNumber,
        voucherRef
      }
    });
    // Auto-post double entry + maj statut facture / facture fournisseur
    await autoPostTransactions({ tx, movement, moneyAccount, amount: auth.amount, direction: auth.flow === 'IN' ? 'IN' : 'OUT', kind: deriveKindFromAuthorization(auth), invoiceId: auth.invoiceId, incomingInvoiceId: auth.incomingInvoiceId });
    if (auth.invoiceId) await updateInvoiceSettlementStatus(tx, auth.invoiceId);
    if (auth.incomingInvoiceId) await updateIncomingInvoiceSettlementStatus(tx, auth.incomingInvoiceId);
    // Mark executed
    await tx.treasuryAuthorization.update({ where: { id: auth.id }, data: { status: 'EXECUTED', executedAt: new Date() } });
    return movement;
  });
}

function deriveKindFromAuthorization(auth) {
  // Minimal mapping; can expand later
  if (auth.flow === 'IN') {
    if (auth.invoiceId) return 'CLIENT_RECEIPT';
    return 'OTHER';
  } else { // OUT
    if (auth.incomingInvoiceId) return 'SUPPLIER_PAYMENT';
    return 'OTHER';
  }
}

export async function listAuthorizations({ status, docType, flow, party, limit = 50 }) {
  const normalizedStatus = status === 'AUTHORIZED' ? 'APPROVED' : status;
  const where = {};
  if (normalizedStatus) where.status = normalizedStatus;
  if (docType) where.docType = docType;
  if (flow) where.flow = flow;
  if (party === 'CLIENT') where.invoiceId = { not: null };
  if (party === 'SUPPLIER') where.incomingInvoiceId = { not: null };
  const rows = await prisma.treasuryAuthorization.findMany({
    where,
    orderBy: { issueDate: 'desc' },
    take: limit,
    include: {
      invoice: { select: { id: true, invoiceNumber: true, client: { select: { name: true } }, totalAmount: true, paidAmount: true, outstandingAmount: true } },
      incomingInvoice: { select: { id: true, entryNumber: true, supplierInvoiceNumber: true, supplier: { select: { name: true } }, totalAmount: true, paidAmount: true, outstandingAmount: true } }
    }
  });
  return rows.map(r => {
    const clientName = r.invoice?.client?.name;
    const supplierName = r.incomingInvoice?.supplier?.name;
    const invoiceNumber = r.invoice?.invoiceNumber;
    const incomingNumber = r.incomingInvoice?.entryNumber || r.incomingInvoice?.supplierInvoiceNumber;
    const total = r.invoice ? r.invoice.totalAmount : r.incomingInvoice ? r.incomingInvoice.totalAmount : null;
    const outstanding = r.invoice ? r.invoice.outstandingAmount : r.incomingInvoice ? r.incomingInvoice.outstandingAmount : null;
    const paid = r.invoice ? r.invoice.paidAmount : r.incomingInvoice ? r.incomingInvoice.paidAmount : null;
    let remainingStr = null, totalStr = null, partial = false, exceededRemaining = false;
    if (total != null && outstanding != null) {
      remainingStr = outstanding.toString();
      totalStr = total.toString();
      if (paid && outstanding && !outstanding.equals && Number(outstanding) > 0) {
        // paid>0 & outstanding>0 => partiel; si Decimal use toString fallback numeric cast
        const paidNum = paid.toString ? Number(paid.toString()) : Number(paid);
        const outNum = outstanding.toString ? Number(outstanding.toString()) : Number(outstanding);
        if (paidNum > 0 && outNum > 0) partial = true;
      }
      // Indicateur dépassement: montant autorisé > restant (pour flux cohérent)
      const authAmountNum = Number(r.amount);
      const outstandingNum = outstanding.toString ? Number(outstanding.toString()) : Number(outstanding);
  if (!isNaN(authAmountNum) && !isNaN(outstandingNum) && r.flow === 'IN' && r.invoiceId) {
        // Encaissement client: dépassement si montant autorisation > reste dû
        if (authAmountNum > outstandingNum) exceededRemaining = true;
      }
  if (!isNaN(authAmountNum) && !isNaN(outstandingNum) && r.flow === 'OUT' && r.incomingInvoiceId) {
        // Paiement fournisseur: pareil
        if (authAmountNum > outstandingNum) exceededRemaining = true;
      }
    }
    const statusOut = r.status === 'AUTHORIZED' ? 'APPROVED' : r.status;
    return {
      id: r.id,
      docNumber: r.docNumber,
      docType: r.docType,
      flow: r.flow,
      amount: r.amount?.toString?.() || r.amount,
      currency: r.currency,
      status: statusOut,
      issueDate: r.issueDate,
      invoiceNumber: invoiceNumber || null,
      incomingInvoiceNumber: incomingNumber || null,
      partyName: clientName || supplierName || null,
      remainingAmount: remainingStr,
      totalLinkedAmount: totalStr,
      partial,
      exceededRemaining
    };
  });
}

export async function createBankAdvice({ adviceType, amount, authorizationId, invoiceId, incomingInvoiceId, adviceDate, currency='EUR', refNumber, purpose }) {
  if (!adviceType) throw new Error('adviceType requis');
  if (!amount || Number(amount) <= 0) throw new Error('Montant > 0 requis');
  return prisma.bankAdvice.create({
    data: {
      adviceType, amount: new Prisma.Decimal(amount), authorizationId: authorizationId || null,
      invoiceId: invoiceId || null, incomingInvoiceId: incomingInvoiceId || null,
      adviceDate: adviceDate ? new Date(adviceDate) : new Date(), currency, refNumber: refNumber || null, purpose: purpose || null
    }
  });
}

export async function linkBankAdviceToMovement({ bankAdviceId, moneyAccountId, description }) {
  return prisma.$transaction(async (tx) => {
    const advice = await tx.bankAdvice.findUnique({ where: { id: bankAdviceId } });
    if (!advice) throw new Error('Advice introuvable');
    // Determine direction
    const direction = advice.adviceType === 'CREDIT' ? 'IN' : 'OUT';
    const voucherRef = `ADV-${advice.id.slice(0,8)}`;
    const movement = await tx.moneyMovement.create({
      data: {
        moneyAccountId,
        amount: advice.amount,
        direction,
        kind: deriveKindFromAdvice(advice),
        bankAdviceId: advice.id,
        invoiceId: advice.invoiceId || null,
        incomingInvoiceId: advice.incomingInvoiceId || null,
        authorizationId: advice.authorizationId || null,
        description: description || advice.purpose || advice.refNumber || 'Bank advice',
        voucherRef
      }
    });
    // If advice links an authorization still APPROVED and matching flow, mark executed
    if (advice.authorizationId) {
      const auth = await tx.treasuryAuthorization.findUnique({ where: { id: advice.authorizationId } });
      if (auth && auth.status === 'APPROVED') {
        await tx.treasuryAuthorization.update({ where: { id: auth.id }, data: { status: 'EXECUTED', executedAt: new Date() } });
      }
    }
    return movement;
  });
}

function deriveKindFromAdvice(advice) {
  if (advice.adviceType === 'CREDIT') {
    if (advice.invoiceId) return 'CLIENT_RECEIPT';
    return 'OTHER';
  } else { // DEBIT
    if (advice.incomingInvoiceId) return 'SUPPLIER_PAYMENT';
    return 'OTHER';
  }
}

export async function listBankAdvices({ adviceType, authorizationId, limit = 50 }) {
  const where = {};
  if (adviceType) where.adviceType = adviceType;
  if (authorizationId) where.authorizationId = authorizationId;
  return prisma.bankAdvice.findMany({ where, orderBy: { adviceDate: 'desc' }, take: limit });
}
