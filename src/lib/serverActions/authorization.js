import prisma from '../prisma.js';
import { Prisma } from '@prisma/client';
import { autoPostTransactions, updateInvoiceSettlementStatus, updateIncomingInvoiceSettlementStatus, ensureLedgerAccountForMoneyAccount, ensureMoneyAccountForTreasurySelection } from './money.js';
import { getCompanyCurrency } from '@/lib/companyContext';

/** Utility: generate a simple docNumber. Real sequencing can replace later. */
function generateDocNumber(docType) {
  const ts = new Date();
  const y = ts.getFullYear();
  const pad = (n) => String(n).padStart(2,'0');
  return `${docType}-${y}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${ts.getTime().toString().slice(-5)}`;
}

function requireCompanyId(companyId) {
  if (!companyId) throw new Error('companyId requis');
  return companyId;
}

const OTHER_ACCOUNT_PREFIXES = {
  OTHER_ASSET: ['2', '3', '4'],
  OTHER_PASSIVE: ['1', '4'],
};

function assertAccountNature(account, nature) {
  if (!nature || !OTHER_ACCOUNT_PREFIXES[nature]) return;
  const allowed = OTHER_ACCOUNT_PREFIXES[nature];
  if (!allowed.some((prefix) => account.number?.startsWith(prefix))) {
    throw new Error(
      nature === 'OTHER_ASSET'
        ? 'Le compte sélectionné doit être un compte actif ou débiteur'
        : 'Le compte sélectionné doit être un compte passif ou créditeur'
    );
  }
}

export async function createAuthorization({ companyId, docType, scope, flow, amount, currency, beneficiaryType, beneficiaryAccountId, beneficiaryAccountNature, invoiceId, incomingInvoiceId, purpose, instrumentType, instrumentRef, issueDate }) {
  const scopedCompanyId = requireCompanyId(companyId);
  if (!docType) throw new Error('docType requis');
  if (!amount || Number(amount) <= 0) throw new Error('Montant > 0 requis');
  const resolvedCurrency = currency || await getCompanyCurrency(scopedCompanyId);

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
  if (invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: scopedCompanyId }, select: { id: true } });
    if (!invoice) throw new Error('Facture client introuvable dans la société active');
  }
  if (incomingInvoiceId) {
    const invoice = await prisma.incomingInvoice.findFirst({ where: { id: incomingInvoiceId, companyId: scopedCompanyId }, select: { id: true } });
    if (!invoice) throw new Error('Facture fournisseur introuvable dans la société active');
  }
  if (beneficiaryAccountId) {
    const account = await prisma.account.findFirst({
      where: { id: beneficiaryAccountId, companyId: scopedCompanyId },
      select: { id: true, number: true },
    });
    if (!account) throw new Error('Compte autre actif/passif introuvable dans la société active');
    assertAccountNature(account, beneficiaryAccountNature);
  }
  if ((invoiceId || incomingInvoiceId) && beneficiaryAccountId) {
    throw new Error('Choisir soit une facture, soit un compte autre actif/passif, pas les deux');
  }
  return prisma.treasuryAuthorization.create({
    data: {
      companyId: scopedCompanyId,
      docType: normalizedDocType,
      scope: resolvedScope,
      flow: resolvedFlow,
      amount: new Prisma.Decimal(amount),
      currency: resolvedCurrency,
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

export async function authorizeAuthorization(id, companyId) {
  const scopedCompanyId = requireCompanyId(companyId);
  return prisma.$transaction(async (tx) => {
    const auth = await tx.treasuryAuthorization.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!auth) throw new Error('Authorization introuvable');
    if (auth.status !== 'DRAFT') throw new Error('Seulement DRAFT -> APPROVED');
    return tx.treasuryAuthorization.update({ where: { id: auth.id }, data: { status: 'APPROVED' } });
  });
}

export async function cancelAuthorization(id, companyId) {
  const scopedCompanyId = requireCompanyId(companyId);
  return prisma.$transaction(async (tx) => {
    const auth = await tx.treasuryAuthorization.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!auth) throw new Error('Authorization introuvable');
    if (auth.status === 'EXECUTED') throw new Error('Impossible d\'annuler EXECUTED');
    if (auth.status === 'CANCELLED') return auth; // idempotent
    return tx.treasuryAuthorization.update({ where: { id: auth.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  });
}

export async function deleteAuthorization(id, companyId) {
  const scopedCompanyId = requireCompanyId(companyId);
  return prisma.$transaction(async (tx) => {
    const auth = await tx.treasuryAuthorization.findFirst({
      where: { id, companyId: scopedCompanyId },
      include: {
        moneyMovements: { select: { id: true } },
        bankAdvices: { select: { id: true } },
      },
    });
    if (!auth) throw new Error("Authorization introuvable");
    if (!["DRAFT", "CANCELLED"].includes(auth.status)) {
      throw new Error("Suppression autorisée seulement pour DRAFT ou CANCELLED");
    }
    if ((auth.moneyMovements?.length || 0) > 0) {
      throw new Error("Impossible de supprimer une autorisation déjà liée à des mouvements");
    }
    if ((auth.bankAdvices?.length || 0) > 0) {
      throw new Error("Impossible de supprimer une autorisation déjà liée à des avis bancaires");
    }
    await tx.treasuryAuthorization.delete({
      where: { id: auth.id },
    });
    return { ok: true, id: auth.id };
  });
}

/** Create a movement executing an APPROVED authorization. */
export async function executeAuthorizationViaMovement({ authorizationId, moneyAccountId, description, companyId }) {
  const scopedCompanyId = requireCompanyId(companyId);
  return prisma.$transaction(async (tx) => {
    moneyAccountId = await ensureMoneyAccountForTreasurySelection(
      moneyAccountId,
      scopedCompanyId,
      tx
    );
    const auth = await tx.treasuryAuthorization.findFirst({ where: { id: authorizationId, companyId: scopedCompanyId } });
    if (!auth) throw new Error('Authorization introuvable');
    if (auth.status !== 'APPROVED') throw new Error('Authorization non APPROVED');
    // Create movement
    const voucherRef = `AUT-${auth.docNumber}`;
    const moneyAccount = await tx.moneyAccount.findFirst({ where: { id: moneyAccountId, companyId: scopedCompanyId }, include: { ledgerAccount: true } });
    if (!moneyAccount) throw new Error('Compte trésorerie introuvable');
    if (!moneyAccount.ledgerAccountId) {
      const { account: createdLedger } = await ensureLedgerAccountForMoneyAccount(moneyAccount, scopedCompanyId);
      moneyAccount.ledgerAccountId = createdLedger.id;
      moneyAccount.ledgerAccount = createdLedger;
    }
    const movement = await tx.moneyMovement.create({
      data: {
        companyId: scopedCompanyId,
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
    await autoPostTransactions({
      tx,
      movement,
      moneyAccount,
      amount: auth.amount,
      direction: auth.flow === 'IN' ? 'IN' : 'OUT',
      kind: deriveKindFromAuthorization(auth),
      invoiceId: auth.invoiceId,
      incomingInvoiceId: auth.incomingInvoiceId,
      counterpartAccountId: auth.beneficiaryAccountId || null,
      companyId: scopedCompanyId,
    });
    if (auth.invoiceId) await updateInvoiceSettlementStatus(tx, auth.invoiceId, scopedCompanyId);
    if (auth.incomingInvoiceId) await updateIncomingInvoiceSettlementStatus(tx, auth.incomingInvoiceId, scopedCompanyId);
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

export async function listAuthorizations({ companyId, status, docType, scope, flow, party, limit = 50 }) {
  const scopedCompanyId = requireCompanyId(companyId);
  const normalizedStatus = status === 'AUTHORIZED' ? 'APPROVED' : status;
  const where = { companyId: scopedCompanyId };
  if (normalizedStatus) where.status = normalizedStatus;
  if (docType) where.docType = docType;
  if (scope) where.scope = scope;
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
  const beneficiaryAccountIds = [...new Set(rows.map((row) => row.beneficiaryAccountId).filter(Boolean))];
  const beneficiaryAccounts = beneficiaryAccountIds.length
    ? await prisma.account.findMany({
        where: { id: { in: beneficiaryAccountIds }, companyId: scopedCompanyId },
        select: { id: true, number: true, label: true },
      })
    : [];
  const beneficiaryAccountById = new Map(beneficiaryAccounts.map((account) => [account.id, account]));
  return rows.map(r => {
    const clientName = r.invoice?.client?.name;
    const supplierName = r.incomingInvoice?.supplier?.name;
    const invoiceNumber = r.invoice?.invoiceNumber;
    const incomingNumber = r.incomingInvoice?.entryNumber || r.incomingInvoice?.supplierInvoiceNumber;
    const total = r.invoice ? r.invoice.totalAmount : r.incomingInvoice ? r.incomingInvoice.totalAmount : null;
    const outstanding = r.invoice ? r.invoice.outstandingAmount : r.incomingInvoice ? r.incomingInvoice.outstandingAmount : null;
    const paid = r.invoice ? r.invoice.paidAmount : r.incomingInvoice ? r.incomingInvoice.paidAmount : null;
    const beneficiaryAccount = r.beneficiaryAccountId ? beneficiaryAccountById.get(r.beneficiaryAccountId) : null;
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
      partyName: clientName || supplierName || (beneficiaryAccount ? `${beneficiaryAccount.number} - ${beneficiaryAccount.label}` : null),
      beneficiaryAccountNumber: beneficiaryAccount?.number || null,
      beneficiaryAccountLabel: beneficiaryAccount?.label || null,
      remainingAmount: remainingStr,
      totalLinkedAmount: totalStr,
      partial,
      exceededRemaining
    };
  });
}

export async function createBankAdvice({ companyId, adviceType, amount, authorizationId, invoiceId, incomingInvoiceId, adviceDate, currency, refNumber, purpose }) {
  const scopedCompanyId = requireCompanyId(companyId);
  if (!adviceType) throw new Error('adviceType requis');
  if (!amount || Number(amount) <= 0) throw new Error('Montant > 0 requis');
  const resolvedCurrency = currency || await getCompanyCurrency(scopedCompanyId);
  if (authorizationId) {
    const auth = await prisma.treasuryAuthorization.findFirst({ where: { id: authorizationId, companyId: scopedCompanyId }, select: { id: true } });
    if (!auth) throw new Error('Autorisation introuvable dans la société active');
  }
  if (invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: scopedCompanyId }, select: { id: true } });
    if (!invoice) throw new Error('Facture client introuvable dans la société active');
  }
  if (incomingInvoiceId) {
    const invoice = await prisma.incomingInvoice.findFirst({ where: { id: incomingInvoiceId, companyId: scopedCompanyId }, select: { id: true } });
    if (!invoice) throw new Error('Facture fournisseur introuvable dans la société active');
  }
  return prisma.bankAdvice.create({
    data: {
      companyId: scopedCompanyId,
      adviceType, amount: new Prisma.Decimal(amount), authorizationId: authorizationId || null,
      invoiceId: invoiceId || null, incomingInvoiceId: incomingInvoiceId || null,
      adviceDate: adviceDate ? new Date(adviceDate) : new Date(), currency: resolvedCurrency, refNumber: refNumber || null, purpose: purpose || null
    }
  });
}

export async function linkBankAdviceToMovement({ bankAdviceId, moneyAccountId, description, companyId }) {
  const scopedCompanyId = requireCompanyId(companyId);
  return prisma.$transaction(async (tx) => {
    moneyAccountId = await ensureMoneyAccountForTreasurySelection(
      moneyAccountId,
      scopedCompanyId,
      tx
    );
    const advice = await tx.bankAdvice.findFirst({ where: { id: bankAdviceId, companyId: scopedCompanyId } });
    if (!advice) throw new Error('Advice introuvable');
    // Determine direction
    const direction = advice.adviceType === 'CREDIT' ? 'IN' : 'OUT';
    const voucherRef = `ADV-${advice.id.slice(0,8)}`;
    const movement = await tx.moneyMovement.create({
      data: {
        companyId: scopedCompanyId,
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
      const auth = await tx.treasuryAuthorization.findFirst({ where: { id: advice.authorizationId, companyId: scopedCompanyId } });
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

export async function listBankAdvices({ companyId, adviceType, authorizationId, limit = 50 }) {
  const scopedCompanyId = requireCompanyId(companyId);
  const where = { companyId: scopedCompanyId };
  if (adviceType) where.adviceType = adviceType;
  if (authorizationId) where.authorizationId = authorizationId;
  return prisma.bankAdvice.findMany({ where, orderBy: { adviceDate: 'desc' }, take: limit });
}
