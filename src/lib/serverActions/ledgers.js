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
  // Kinds for fetching all lines we need to DISPLAY (include payment line + main account + detail + VAT)
  const baseKinds = party === 'client' ? ['RECEIVABLE','PAYMENT'] : ['PAYABLE','PAYMENT'];
  // Kinds that impact the party main account balance (exclude PAYMENT to avoid neutralisation by treasury counterpart)
  const mainKinds = party === 'client' ? ['RECEIVABLE'] : ['PAYABLE'];
  const detailKinds = party === 'client' ? ['SALE'] : ['PURCHASE'];
  // Include VAT kinds explicitly so that TVA lines appear
  const vatKinds = party === 'client' ? ['VAT_COLLECTED'] : ['VAT_DEDUCTIBLE'];
  // For balance computations we only use baseKinds (RECEIVABLE/PAYABLE/PAYMENT)
  // For display we ALWAYS need detail lines to derive counterpart accounts (6/7 + 445) even if includeDetails=false
  const displayKinds = [...baseKinds, ...detailKinds, ...vatKinds];

  // Include legacy transactions where partyId was not set but can be inferred through related documents
  const wherePartyKey = party === 'client'
    ? { OR: [ { clientId: id }, { invoice: { clientId: id } } ] }
    : { OR: [ { supplierId: id }, { incomingInvoice: { supplierId: id } } ] };

  // Period where for MAIN account movements only (exclude PAYMENT treasury counterparts)
  const periodWhere = {
    ...wherePartyKey,
    kind: { in: mainKinds },
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
      where: { ...wherePartyKey, kind: { in: mainKinds }, date: { lt: from } },
      _sum: { amount: true }
    });
    for (const g of beforeGroups) {
      const amt = g._sum.amount || new Prisma.Decimal(0);
      // For neutrality we compute debit-credit first; orientation later.
      opening = opening.plus(g.direction === 'DEBIT' ? amt : amt.mul(-1));
    }
  }

  // Fetch transactions inside period (raw ledger lines)
  const rows = await prisma.transaction.findMany({
    where: {
      ...wherePartyKey,
      kind: { in: displayKinds },
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    orderBy: { date: 'asc' },
    take: limit,
    include: {
      account: { select: { number: true, label: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, dueDate: true, invoiceLines: { select: { id: true, description: true, lineTotal: true, account: { select: { number: true, label: true } } }, take: 5 }, _count: { select: { invoiceLines: true } } } },
  incomingInvoice: { select: { id: true, supplierId: true, entryNumber: true, supplierInvoiceNumber: true, status: true, dueDate: true, lines: { select: { id: true, description: true, lineTotal: true, account: { select: { number: true, label: true } } }, take: 5 }, _count: { select: { lines: true } } } },
      moneyMovement: { select: { id: true, voucherRef: true, kind: true, authorization: { select: { docNumber: true } }, bankAdvice: { select: { refNumber: true } }, moneyAccount: { select: { ledgerAccount: { select: { number: true, label: true } }, label: true } } } }
    }
  });

  // Totals (period) only for MAIN account movements (exclude treasury PAYMENT lines)
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

  // ------------------------------------------------------------
  // Phase 2 display model:
  //  * For invoices: show ONLY counterpart accounts (6xxx/7xxx) + ONE VAT line (445*)
  //  * Exclude the main 401/411 line
  //  * For payments: show ONLY the treasury account line (512/53/51x) and exclude 401/411
  //  * Running balance evolves only when the economic event impacts the 401/411 amount:
  //      - After the LAST visible line of an invoice group (i.e. after VAT line if present, else last expense/revenue line)
  //      - On the payment line
  //  * Intermediate lines of an invoice keep previous running
  // ------------------------------------------------------------

  const isMainAccount = (acctNumber) => {
    if (!acctNumber) return false;
    return party === 'supplier' ? /^401/.test(acctNumber) : /^411/.test(acctNumber);
  };
  const isVat = (acctNumber) => acctNumber ? /^445/.test(acctNumber) : false;
  const isExpense = (acctNumber) => acctNumber ? /^6/.test(acctNumber) : false;
  const isRevenue = (acctNumber) => acctNumber ? /^7/.test(acctNumber) : false;
  const isTreasury = (acctNumber) => acctNumber ? /^(512|53|51)/.test(acctNumber) : false;

  // Grouping simplifié :
  //  - Factures (INV_SUP / INV_CLI)
  //  - Paiements via moneyMovement (MM:<id>)
  //  - Paiements manuels (banque) : PAYBANK:<tx.id> (transaction kind=PAYMENT nature=payment)
  //  - Transactions orphelines (TX:<id>)
  const groupMap = new Map();
  const pushToGroup = (key, tx) => { if (!groupMap.has(key)) groupMap.set(key, []); groupMap.get(key).push(tx); };

  for (const t of rows) {
    const mvKind = t.moneyMovement?.kind;
    if (mvKind === 'SUPPLIER_PAYMENT' || mvKind === 'CLIENT_RECEIPT') {
      pushToGroup('MM:' + t.moneyMovement.id, t);
      continue;
    }
  if (t.kind === 'PAYMENT') {
      // banque (ne pas regrouper avec autre ligne payable, on la cachera de toute façon)
      pushToGroup('PAYBANK:' + t.id, t);
      continue;
    }
  if ((t.kind === 'PAYABLE' || t.kind === 'RECEIVABLE') && t.description && /Règlement facture/.test(t.description)) {
      // On ignore la ligne principale 401/411 (utilisée seulement pour delta) -> pas d'ajout de groupe
      continue;
    }
    if (t.incomingInvoice) { pushToGroup('INV_SUP:' + t.incomingInvoice.id, t); continue; }
    if (t.invoice) { pushToGroup('INV_CLI:' + t.invoice.id, t); continue; }
    pushToGroup('TX:' + t.id, t);
  }

  const groups = Array.from(groupMap.entries()).map(([key, txs]) => ({
    key,
    txs: txs.sort((a,b)=> new Date(a.date) - new Date(b.date)),
    date: txs[0]?.date || new Date()
  })).sort((a,b)=> new Date(a.date) - new Date(b.date));

  let neutralRunning = opening; // debit - credit perspective of main account
  let orientedRunning = orientation === 'CLIENT' ? neutralRunning : neutralRunning.mul(-1);
  const displayRows = [];

  const addRow = (row) => { displayRows.push(row); };

  for (const g of groups) {
  const txs = g.txs;
  const sample = txs[0];
  const isPaymentGroup = sample.moneyMovement?.kind === 'SUPPLIER_PAYMENT' || sample.moneyMovement?.kind === 'CLIENT_RECEIPT';
    const incomingInv = txs.find(t=> t.incomingInvoice)?.incomingInvoice || null;
    const salesInv = txs.find(t=> t.invoice)?.invoice || null;
    const isSupplierInvoice = !!incomingInv;
    const isClientInvoice = !!salesInv;

    if (isPaymentGroup) {
      // Identify main 401/411 line (fallback to kind PAYABLE/RECEIVABLE if number pattern not matched)
      const mainTx = txs.find(t=> isMainAccount(t.account?.number)) || txs.find(t=> t.kind === (party==='supplier' ? 'PAYABLE' : 'RECEIVABLE'));
      // If a treasury line with supplierId/clientId exists capture it (non main account)
      let treasuryTx = txs.find(t=> !isMainAccount(t.account?.number) && t.kind === 'PAYMENT');
      const amountDecimal = mainTx ? new Prisma.Decimal(mainTx.amount) : (treasuryTx ? new Prisma.Decimal(treasuryTx.amount) : new Prisma.Decimal(0));
      // Compute neutral delta using MAIN line; if absent, sum all main-kind lines as fallback
      let neutralDelta = new Prisma.Decimal(0);
      if (mainTx) {
        neutralDelta = mainTx.direction === 'DEBIT' ? amountDecimal : amountDecimal.mul(-1);
      } else {
        const mains = txs.filter(t=> t.kind === (party==='supplier' ? 'PAYABLE' : 'RECEIVABLE'));
        for (const m of mains) {
          const amt = new Prisma.Decimal(m.amount);
            neutralDelta = neutralDelta.plus(m.direction === 'DEBIT' ? amt : amt.mul(-1));
        }
      }
      neutralRunning = neutralRunning.plus(neutralDelta);
      orientedRunning = orientation === 'CLIENT' ? neutralRunning : neutralRunning.mul(-1);

      // Synthesize treasury display if counterpart not present
      const synthetic = !treasuryTx;
      const treasuryAccountNumber = mainTx?.moneyMovement?.moneyAccount?.ledgerAccount?.number || mainTx?.moneyMovement?.moneyAccount?.ledgerAccount?.number;
      const treasuryAccountLabel = mainTx?.moneyMovement?.moneyAccount?.ledgerAccount?.label || mainTx?.moneyMovement?.moneyAccount?.ledgerAccount?.label;
      const direction = (()=> {
        if (treasuryTx) return treasuryTx.direction;
        // If supplier: payment entry has mainTx DEBIT on 401 => treasury should be CREDIT
        if (party === 'supplier') return mainTx?.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
        // client receipt: mainTx CREDIT on 411 => treasury should be DEBIT
        if (party === 'client') return mainTx?.direction === 'CREDIT' ? 'DEBIT' : 'CREDIT';
        return 'DEBIT';
      })();
      const amountNumber = Number(amountDecimal);
      const description = (party === 'supplier')
        ? (incomingInv?.entryNumber || mainTx?.moneyMovement?.authorization?.docNumber || 'Règlement')
        : (salesInv?.invoiceNumber || mainTx?.moneyMovement?.authorization?.docNumber || 'Encaissement');
      const invoiceRef = mainTx?.moneyMovement?.voucherRef || mainTx?.moneyMovement?.authorization?.docNumber || mainTx?.moneyMovement?.bankAdvice?.refNumber || mainTx?.moneyMovement?.id;
      addRow({
        id: (treasuryTx?.id || (mainTx?.id + '-PAY')),
        date: (treasuryTx?.date || mainTx?.date),
        accountNumber: treasuryTx?.account?.number || treasuryAccountNumber || null,
        accountLabel: treasuryTx?.account?.label || treasuryAccountLabel || null,
        description,
        kind: mainTx?.kind || treasuryTx?.kind || 'PAYMENT',
        debit: direction === 'DEBIT' ? amountNumber : null,
        credit: direction === 'CREDIT' ? amountNumber : null,
        invoiceRef,
        invoiceStatus: salesInv?.status || incomingInv?.status || null,
        invoiceDueDate: salesInv?.dueDate || incomingInv?.dueDate || null,
        running: Number(orientedRunning),
        movementId: mainTx?.moneyMovement?.id || treasuryTx?.moneyMovement?.id || null,
        paymentRef: mainTx?.moneyMovement?.voucherRef || mainTx?.moneyMovement?.authorization?.docNumber || mainTx?.moneyMovement?.bankAdvice?.refNumber || null,
        movementKind: mainTx?.moneyMovement?.kind || treasuryTx?.moneyMovement?.kind || null,
        linesPreview: null,
        isPayment: true,
        isVat: false,
        isInvoiceLast: true
      });
      continue;
    }

    if (g.key.startsWith('PAYBANK:')) {
      const bankTx = txs[0];
      const invoiceObj = bankTx.incomingInvoice || bankTx.invoice;
      // Rechercher la ligne principale 401/411 correspondante (même facture + nature payment + montant)
      const mainTx = rows.find(r => r !== bankTx && r.nature === 'payment' && r.kind === (party==='supplier' ? 'PAYABLE' : 'RECEIVABLE') && ((r.incomingInvoice && bankTx.incomingInvoice && r.incomingInvoice.id === bankTx.incomingInvoice.id) || (r.invoice && bankTx.invoice && r.invoice.id === bankTx.invoice.id)) && r.amount === bankTx.amount);
      // Si le compte banque (account.number) est absent, essayer de récupérer via moneyMovement associé s'il existe (rare ici) ou marquer 'BANQUE'
      let accountNumber = bankTx.account?.number || bankTx.moneyMovement?.moneyAccount?.ledgerAccount?.number || null;
      let accountLabel = bankTx.account?.label || bankTx.moneyMovement?.moneyAccount?.ledgerAccount?.label || null;
      if (!accountNumber) {
        accountNumber = '5XXX';
        if (!accountLabel) accountLabel = 'Banque (synthetique)';
      }
      let neutralDelta = new Prisma.Decimal(0);
      if (mainTx) neutralDelta = mainTx.direction === 'DEBIT' ? new Prisma.Decimal(mainTx.amount) : new Prisma.Decimal(mainTx.amount).mul(-1);
      else {
        // Inférence : pour fournisseur, réduction dette = DEBIT 401, donc delta positif = montant bankTx
        // pour client, réduction créance = CREDIT 411, donc delta négatif (neutral) = -montant
        const amt = new Prisma.Decimal(bankTx.amount);
        neutralDelta = party === 'supplier' ? amt : amt.mul(-1);
      }
      neutralRunning = neutralRunning.plus(neutralDelta);
      orientedRunning = orientation === 'CLIENT' ? neutralRunning : neutralRunning.mul(-1);
      const description = party === 'supplier'
        ? (invoiceObj?.entryNumber || 'Règlement')
        : (invoiceObj?.invoiceNumber || 'Encaissement');
      const invoiceRef = invoiceObj?.entryNumber || invoiceObj?.invoiceNumber || null;
      addRow({
        id: bankTx.id,
        date: bankTx.date,
        accountNumber,
        accountLabel,
        description,
        kind: 'PAYMENT',
        debit: bankTx.direction === 'DEBIT' ? Number(bankTx.amount) : null,
        credit: bankTx.direction === 'CREDIT' ? Number(bankTx.amount) : null,
        invoiceRef,
        invoiceStatus: invoiceObj?.status || null,
        invoiceDueDate: invoiceObj?.dueDate || null,
        running: Number(orientedRunning),
        movementId: null,
        paymentRef: null,
        movementKind: null,
        linesPreview: null,
        isPayment: true,
        isVat: false,
        isInvoiceLast: true
      });
      continue;
    }

    if (isSupplierInvoice || isClientInvoice) {
      const mainTx = txs.find(t=> isMainAccount(t.account?.number)) || txs.find(t=> t.kind === (party==='supplier' ? 'PAYABLE' : 'RECEIVABLE'));
      // Visible counterpart lines
      const visibleLines = txs.filter(t=> {
        const num = t.account?.number;
        if (isMainAccount(num)) return false;
        if (party === 'supplier') return isExpense(num) || isVat(num);
        return isRevenue(num) || isVat(num);
      });
      // Separate VAT lines for consolidation
      const vatLines = visibleLines.filter(t=> isVat(t.account?.number));
      const nonVatLines = visibleLines.filter(t=> !isVat(t.account?.number));

      let consolidatedVatLine = null;
      if (vatLines.length) {
        const dir = vatLines[0].direction; // homogène supposé
        let sum = new Prisma.Decimal(0);
        for (const v of vatLines) sum = sum.plus(new Prisma.Decimal(v.amount));

        // Correction anti-double: si on dispose de la ligne principale (401/411) on recalcule la TVA attendue
        // expectedVat = |mainTx.amount| - somme(nonVatLines)
        if (mainTx) {
          let nonVatSum = new Prisma.Decimal(0);
          for (const nv of nonVatLines) nonVatSum = nonVatSum.plus(new Prisma.Decimal(nv.amount));
          const expectedVat = new Prisma.Decimal(mainTx.amount).abs().minus(nonVatSum.abs());
          // Si expectedVat positif et significativement différent (>0.01) et plus petit que sum*1.01 (cas doublement), on ajuste
          if (expectedVat.greaterThan(0) && expectedVat.minus(sum).abs().greaterThan(new Prisma.Decimal(0.01)) && (sum.greaterThan(expectedVat))) {
            sum = expectedVat;
          }
        }

        consolidatedVatLine = {
          ...vatLines[0],
          id: vatLines[0].id + '-VAT',
          amount: sum,
          direction: dir,
          _isVatConsolidated: true
        };
      }
      const orderedDisplayed = [...nonVatLines];
      if (consolidatedVatLine) orderedDisplayed.push(consolidatedVatLine);

      // Compute neutral delta (invoice impact on main account) using mainTx
      let invoiceNeutralDelta = new Prisma.Decimal(0);
      if (mainTx) {
        invoiceNeutralDelta = mainTx.direction === 'DEBIT' ? new Prisma.Decimal(mainTx.amount) : new Prisma.Decimal(mainTx.amount).mul(-1);
      } else {
        // fallback: sum of counterparts * -1 if they are all DEBIT for supplier, or all CREDIT for client
        for (const l of txs) {
          const n = l.direction === 'DEBIT' ? new Prisma.Decimal(l.amount) : new Prisma.Decimal(l.amount).mul(-1);
          invoiceNeutralDelta = invoiceNeutralDelta.plus(n);
        }
      }
      // Running will update only on last line
      const preRunningNeutral = neutralRunning;
      const finalNeutralRunning = neutralRunning.plus(invoiceNeutralDelta);
      const finalOrientedRunning = orientation === 'CLIENT' ? finalNeutralRunning : finalNeutralRunning.mul(-1);

      for (let i=0;i<orderedDisplayed.length;i++) {
        const line = orderedDisplayed[i];
        const isLast = i === orderedDisplayed.length -1;
        const baseInv = incomingInv || salesInv;
        // Description logic similar to previous version
        let description = line.description || line.account?.label || '';
  if (line._isVatConsolidated) description = 'TVA';
        else {
          if (party === 'supplier') {
            if (incomingInv) {
              const lines = incomingInv.lines || [];
              const totalLines = incomingInv._count?.lines ?? lines.length;
              if (/^6/.test(line.account?.number||'')) {
                if (totalLines === 1 && lines[0]) description = lines[0].description;
                else if (totalLines > 1) description = 'Achat Divers produits';
                else description = 'Achat';
              }
            }
          } else {
            if (salesInv) {
              const lines = salesInv.invoiceLines || [];
              const totalLines = salesInv._count?.invoiceLines ?? lines.length;
              if (/^7/.test(line.account?.number||'')) {
                if (totalLines === 1 && lines[0]) description = lines[0].description;
                else if (totalLines > 1) description = 'Vente Divers produits';
                else description = 'Vente';
              }
            }
          }
        }
        const invoiceRef = salesInv?.invoiceNumber || incomingInv?.entryNumber || null;
        const orientedRunForRow = isLast ? finalOrientedRunning : (orientation === 'CLIENT' ? preRunningNeutral : preRunningNeutral.mul(-1));
        addRow({
          id: line.id,
            date: line.date,
            accountNumber: line.account?.number || null,
            accountLabel: line.account?.label || null,
            description,
            kind: sample.kind,
            debit: line.direction === 'DEBIT' ? Number(line.amount) : null,
            credit: line.direction === 'CREDIT' ? Number(line.amount) : null,
            invoiceRef,
            invoiceStatus: salesInv?.status || incomingInv?.status || null,
            invoiceDueDate: salesInv?.dueDate || incomingInv?.dueDate || null,
            running: Number(orientedRunForRow),
            movementId: sample.moneyMovement?.id || null,
            paymentRef: sample.moneyMovement?.voucherRef || sample.moneyMovement?.authorization?.docNumber || sample.moneyMovement?.bankAdvice?.refNumber || null,
            movementKind: sample.moneyMovement?.kind || null,
            linesPreview: null,
            isPayment: false,
            isVat: !!line._isVatConsolidated,
            isInvoiceLast: isLast
        });
      }
      neutralRunning = finalNeutralRunning;
      orientedRunning = finalOrientedRunning;
      continue;
    }

    // Fallback: show transaction directly (rare)
    for (const t of txs) {
      const neutralDelta = t.direction === 'DEBIT' ? new Prisma.Decimal(t.amount) : new Prisma.Decimal(t.amount).mul(-1);
      neutralRunning = neutralRunning.plus(neutralDelta);
      orientedRunning = orientation === 'CLIENT' ? neutralRunning : neutralRunning.mul(-1);
      addRow({
        id: t.id,
        date: t.date,
        accountNumber: t.account?.number || null,
        accountLabel: t.account?.label || null,
        description: t.description || t.account?.label || '',
        kind: t.kind,
        debit: t.direction === 'DEBIT' ? Number(t.amount) : null,
        credit: t.direction === 'CREDIT' ? Number(t.amount) : null,
        invoiceRef: t.invoice?.invoiceNumber || t.incomingInvoice?.entryNumber || null,
        invoiceStatus: t.invoice?.status || t.incomingInvoice?.status || null,
        invoiceDueDate: t.invoice?.dueDate || t.incomingInvoice?.dueDate || null,
        running: Number(orientedRunning),
        movementId: t.moneyMovement?.id || null,
        paymentRef: t.moneyMovement?.voucherRef || t.moneyMovement?.authorization?.docNumber || t.moneyMovement?.bankAdvice?.refNumber || null,
        movementKind: t.moneyMovement?.kind || null,
        linesPreview: null
      });
    }
  }

  const ledgerRows = displayRows;

  // Option A: Synthèse paiement manquant pour factures partiellement réglées sans ligne PAYMENT affichée
  if (party === 'supplier') {
    // Regrouper par invoiceRef pour détecter incohérences (nécessite que invoiceRef = entryNumber)
    const byRef = new Map();
    for (const r of ledgerRows) {
      if (!r.invoiceRef) continue; if (!byRef.has(r.invoiceRef)) byRef.set(r.invoiceRef, []); byRef.get(r.invoiceRef).push(r);
    }
    for (const [ref, rowsRef] of byRef.entries()) {
      const hasPayment = rowsRef.some(r=> r.isPayment);
      const supplierLines = rowsRef.filter(r=> !r.isPayment);
      if (!hasPayment && supplierLines.length) {
        // Estimation: si solde après dernière ligne > 0, ne rien faire (pas de paiement). Si solde diminue introuvable => on ne peut pas déduire
        // On ne peut pas inférer montant payé sans connaître total facture ou état partiel : on skip pour éviter faux positifs.
        continue;
      }
    }
  }

  // Debug fallback: si aucun paiement affiché mais il existe des transactions PAYMENT dans la période brute
  if (party === 'supplier') {
    const hadPaymentTx = rows.some(r => r.kind === 'PAYMENT' && r.account?.number && /^(512|53|51|521|522)/.test(r.account.number));
    const displayedPayment = ledgerRows.some(r => r.kind === 'PAYMENT');
    if (hadPaymentTx && !displayedPayment) {
      console.warn('[LEDGER] Paiement détecté dans rows mais aucune ligne PAYMENT affichée (supplierId=' + id + ').');
    }
  }

  const orientedOpening = orientation === 'CLIENT' ? opening : opening.mul(-1);
  // Closing = opening + (debits - credits) for main account, then oriented
  const neutralClosing = opening.plus(periodDebit).minus(periodCredit);
  const orientedClosing = orientation === 'CLIENT' ? neutralClosing : neutralClosing.mul(-1);

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
