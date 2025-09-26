// src/lib/serverActions/ledgers.js
'use server';

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Generic builder for third-party ledger (client or supplier).
 * options: {
 *   party: 'client' | 'supplier',
 *   id: string,
 *   dateStart?: string (yyyy-mm-dd),
 *   dateEnd?: string,
 *   includeDetails?: boolean (include SALE / PURCHASE kinds),
 *   limit?: number
 * }
 * Orientation rules:
 *  - client ledger running balance = debits - credits (positive = receivable)
 *  - supplier ledger running balance = credits - debits (positive = payable)
 */
export async function getThirdPartyLedger({ party, id, dateStart, dateEnd, includeDetails = false, limit = 1000 }) {
  if (!['client','supplier'].includes(party)) throw new Error('party invalide');
  if (!id) throw new Error('id requis');

  // Normalize dates
  let from = dateStart ? new Date(dateStart) : null;
  let to = dateEnd ? new Date(dateEnd) : null;
  if (from && isNaN(from.getTime())) from = null;
  if (to && isNaN(to.getTime())) to = null;
  if (from && to && from > to) { const tmp = from; from = to; to = tmp; }
  if (to) { to.setHours(23,59,59,999); }

  // Kinds selection
  const baseKinds = party === 'client' ? ['RECEIVABLE','PAYMENT'] : ['PAYABLE','PAYMENT'];
  const detailKinds = party === 'client' ? ['SALE'] : ['PURCHASE'];
  const kinds = includeDetails ? [...baseKinds, ...detailKinds] : baseKinds;

  const wherePartyKey = party === 'client' ? { clientId: id } : { supplierId: id };

  const periodWhere = {
    ...wherePartyKey,
    kind: { in: kinds },
  };
  if (from || to) {
    periodWhere.date = {};
    if (from) periodWhere.date.gte = from;
    if (to) periodWhere.date.lte = to;
  }

  // Opening balance (before from)
  let opening = new Prisma.Decimal(0);
  if (from) {
    const beforeGroups = await prisma.transaction.groupBy({
      by: ['direction'],
      where: { ...wherePartyKey, kind: { in: kinds }, date: { lt: from } },
      _sum: { amount: true }
    });
    for (const g of beforeGroups) {
      const amt = g._sum.amount || new Prisma.Decimal(0);
      // For neutrality we compute debit-credit first; orientation later.
      opening = opening.plus(g.direction === 'DEBIT' ? amt : amt.mul(-1));
    }
  }

  // Fetch transactions inside period
  const rows = await prisma.transaction.findMany({
    where: periodWhere,
    orderBy: { date: 'asc' },
    take: limit,
    include: {
      account: { select: { number: true, label: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, dueDate: true } },
      incomingInvoice: { select: { id: true, entryNumber: true, supplierInvoiceNumber: true, status: true, dueDate: true } },
      moneyMovement: { select: { id: true, voucherRef: true, kind: true, authorization: { select: { docNumber: true } }, moneyAccount: { select: { ledgerAccount: { select: { number: true, label: true } }, label: true } } } }
    }
  });

  // Totals (period)
  const periodGroups = await prisma.transaction.groupBy({
    by: ['direction'],
    where: periodWhere,
    _sum: { amount: true }
  });
  let periodDebit = new Prisma.Decimal(0), periodCredit = new Prisma.Decimal(0);
  for (const g of periodGroups) {
    const amt = g._sum.amount || new Prisma.Decimal(0);
    if (g.direction === 'DEBIT') periodDebit = periodDebit.plus(amt); else periodCredit = periodCredit.plus(amt);
  }

  // Orientation adjustment for running balance
  const orientation = party === 'client' ? 'CLIENT' : 'SUPPLIER';

  let running = opening;
  const ledgerRows = rows.map(t => {
    // neutral delta = debit - credit
    const neutralDelta = t.direction === 'DEBIT' ? new Prisma.Decimal(t.amount) : new Prisma.Decimal(t.amount).mul(-1);
    // oriented delta
    const orientedDelta = orientation === 'CLIENT' ? neutralDelta : neutralDelta.mul(-1); // supplier flips
    running = running.plus(neutralDelta); // keep running in neutral for clarity first
    const orientedRunning = orientation === 'CLIENT' ? running : running.mul(-1);
    // Base mapping
    let accountNumber = t.account?.number;
    let accountLabel = t.account?.label;
    let description = t.description || t.account?.label || '';
    let piece = t.invoice?.invoiceNumber || t.incomingInvoice?.entryNumber || null;

    // Supplier specific formatting
    if (party === 'supplier') {
      if (t.kind === 'PAYABLE' && t.incomingInvoice) {
        // Line establishing or adjusting payable
        description = t.incomingInvoice.entryNumber; // Libellé = entry number
        piece = t.incomingInvoice.supplierInvoiceNumber || t.incomingInvoice.entryNumber;
      }
      // Payment line (movement kind SUPPLIER_PAYMENT)
      if (t.moneyMovement?.kind === 'SUPPLIER_PAYMENT') {
        // Show treasury account instead of supplier account
        if (t.moneyMovement.moneyAccount?.ledgerAccount) {
          accountNumber = t.moneyMovement.moneyAccount.ledgerAccount.number;
          accountLabel = t.moneyMovement.moneyAccount.ledgerAccount.label;
        }
        // Libellé = entry invoice number or authorization doc
        if (t.incomingInvoice?.entryNumber) description = t.incomingInvoice.entryNumber;
        else if (t.moneyMovement.authorization?.docNumber) description = t.moneyMovement.authorization.docNumber;
        // Pièce = voucherRef / docNumber / movement id
        piece = t.moneyMovement.voucherRef || t.moneyMovement.authorization?.docNumber || t.moneyMovement.id;
      }
    }
    // Client specific formatting
    if (party === 'client') {
      if (t.kind === 'RECEIVABLE' && t.invoice) {
        description = t.invoice.invoiceNumber;
        piece = t.invoice.invoiceNumber; // no external ref, reuse
      }
      if (t.moneyMovement?.kind === 'CLIENT_RECEIPT') {
        // Show treasury account
        if (t.moneyMovement.moneyAccount?.ledgerAccount) {
          accountNumber = t.moneyMovement.moneyAccount.ledgerAccount.number;
          accountLabel = t.moneyMovement.moneyAccount.ledgerAccount.label;
        }
        if (t.invoice?.invoiceNumber) description = t.invoice.invoiceNumber;
        else if (t.moneyMovement.authorization?.docNumber) description = t.moneyMovement.authorization.docNumber;
        piece = t.moneyMovement.voucherRef || t.moneyMovement.authorization?.docNumber || t.moneyMovement.id;
      }
    }

    return {
      id: t.id,
      date: t.date,
      accountNumber,
      accountLabel,
      description,
      kind: t.kind,
      debit: t.direction === 'DEBIT' ? Number(t.amount) : null,
      credit: t.direction === 'CREDIT' ? Number(t.amount) : null,
      invoiceRef: piece,
      invoiceStatus: t.invoice?.status || t.incomingInvoice?.status || null,
      invoiceDueDate: t.invoice?.dueDate || t.incomingInvoice?.dueDate || null,
      running: Number(orientedRunning),
      movementId: t.moneyMovement?.id || null,
      paymentRef: t.moneyMovement?.voucherRef || t.moneyMovement?.authorization?.docNumber || null,
      movementKind: t.moneyMovement?.kind || null
    };
  });

  const orientedOpening = orientation === 'CLIENT' ? opening : opening.mul(-1);
  const orientedClosing = orientation === 'CLIENT'
    ? opening.plus(periodDebit).minus(periodCredit)
    : opening.plus(periodDebit).minus(periodCredit).mul(-1);

  const limited = rows.length === limit; // simplistic indicator
  // Fetch party meta (name + account) for display/export context
  let partyName = null; let partyAccountNumber = null; let partyAccountLabel = null;
  let partyMeta = {};
  if (party === 'client') {
    const c = await prisma.client.findUnique({ where: { id }, select: { name: true, email: true, address: true, category: true, account: { select: { number: true, label: true } } } });
    if (c) {
      partyName = c.name;
      partyAccountNumber = c.account?.number || null;
      partyAccountLabel = c.account?.label || null;
      partyMeta = { email: c.email, address: c.address, category: c.category };
    }
  } else {
    const s = await prisma.supplier.findUnique({ where: { id }, select: { name: true, email: true, paymentDelay: true, paymentNature: true, account: { select: { number: true, label: true } } } });
    if (s) {
      partyName = s.name; partyAccountNumber = s.account?.number || null; partyAccountLabel = s.account?.label || null;
      partyMeta = { email: s.email, paymentDelay: s.paymentDelay, paymentNature: s.paymentNature };
    }
  }

  return {
    party,
    partyId: id,
    partyName,
    partyAccountNumber,
    partyAccountLabel,
    filter: (from || to) ? { from, to } : null,
    includeDetails: !!includeDetails,
    opening: Number(orientedOpening),
    totals: { debit: Number(periodDebit), credit: Number(periodCredit) },
    closing: Number(orientedClosing),
    rows: ledgerRows,
    limited,
    partyMeta
  };
}

export async function getClientLedger(params) { return getThirdPartyLedger({ party: 'client', ...params }); }
export async function getSupplierLedger(params) { return getThirdPartyLedger({ party: 'supplier', ...params }); }
