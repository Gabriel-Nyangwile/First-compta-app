import prisma from "../prisma.js";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

async function nextSequence(name) {
  return await prisma.$transaction(async (tx) => {
    let seq = await tx.sequence.findUnique({ where: { name } });
    if (!seq) {
      seq = await tx.sequence.create({ data: { name, value: 1 } });
      return seq.value;
    }
    const updated = await tx.sequence.update({
      where: { name },
      data: { value: { increment: 1 } },
    });
    return updated.value;
  });
}

function formatVoucher(prefix, date, num) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${prefix}-${y}${m}-${String(num).padStart(4, "0")}`;
}

/**
 * Create a money movement and its accounting transactions skeleton.
 * Minimal version: only records the movement; transaction double entry is left for future enrichment.
 * Validates: amount>0, account exists, direction consistent.
 */
export async function createMoneyMovement({
  companyId = null,
  moneyAccountId,
  amount,
  direction, // 'IN' | 'OUT'
  kind, // enum MoneyMovementKind
  description,
  invoiceId,
  incomingInvoiceId,
  supplierId,
  // transferGroupId supprimé du schéma : regroupez via voucherRef si besoin
  voucherRef, // facultatif maintenant: généré si absent
  counterpartAccountId, // compte comptable contrepartie explicite si nécessaire
  autoPost = true,
  vatBreakdown, // Pour CASH_PURCHASE: tableau [{rate: 0.20, base: 100}] ou null
}) {
  if (!moneyAccountId) throw new Error("moneyAccountId requis");
  if (!amount || Number(amount) <= 0) throw new Error("Montant doit être > 0");
  if (!["IN", "OUT"].includes(direction)) throw new Error("direction invalide");
  // Forçage des sens selon la nature
  const forcedDirections = {
    CLIENT_RECEIPT: "IN",
    SUPPLIER_PAYMENT: "OUT",
    CASH_PURCHASE: "OUT",
    ASSOCIATE_CONTRIBUTION: "IN",
    ASSOCIATE_WITHDRAWAL: "OUT",
    SALARY_PAYMENT: "OUT",
    SALARY_ADVANCE: "OUT",
  };
  if (forcedDirections[kind] && forcedDirections[kind] !== direction) {
    throw new Error(
      `Direction incohérente pour ${kind}. Doit être ${forcedDirections[kind]}`
    );
  }

  let moneyAccount = await prisma.moneyAccount.findFirst({
    where: { id: moneyAccountId, ...(companyId ? { companyId } : {}) },
    include: { ledgerAccount: true },
  });
  if (!moneyAccount) throw new Error("MoneyAccount introuvable");
  if (!moneyAccount.isActive) throw new Error("Compte inactif");
  // Auto-provision du compte comptable support si absent
  if (!moneyAccount.ledgerAccountId) {
    const { account: createdLedger } = await ensureLedgerAccountForMoneyAccount(
      moneyAccount,
      companyId
    );
    moneyAccount.ledgerAccountId = createdLedger.id;
    moneyAccount.ledgerAccount = createdLedger;
  }

  // Pré-validation simple : empêcher solde négatif caisse (option – ici activé)
  if (moneyAccount.type === "CASH" && direction === "OUT") {
    const bal = await computeMoneyAccountBalance(moneyAccountId, companyId);
    if (bal.minus(amount).lt(0)) throw new Error("Solde caisse insuffisant");
  }

  // Restriction optionnelle: désactiver création directe si variable activée
  if (process.env.REQUIRE_AUTHORIZATION_FOR_MOVEMENTS === "true") {
    // Autoriser seulement les transferts (qui ont leur propre logique) ou mouvements déjà orchestrés via scripts internes.
    if (kind !== "TRANSFER") {
      throw new Error(
        "Création directe désactivée (REQUIRE_AUTHORIZATION_FOR_MOVEMENTS). Utiliser une autorisation."
      );
    }
  }

  // Auto voucherRef if missing
  let finalVoucherRef = voucherRef;
  if (!finalVoucherRef) {
    const seqNum = await nextSequence("MONEY_MOVEMENT");
    finalVoucherRef = formatVoucher("MV", new Date(), seqNum);
  }

  return await prisma.$transaction(async (tx) => {
    let resolvedSupplierId = supplierId || null;
    let resolvedIncomingInvoice = null;
    if (kind === "SUPPLIER_PAYMENT") {
      if (!incomingInvoiceId)
        throw new Error("incomingInvoiceId requis pour SUPPLIER_PAYMENT");
      resolvedIncomingInvoice = await tx.incomingInvoice.findFirst({
        where: { id: incomingInvoiceId, ...(companyId ? { companyId } : {}) },
        include: { supplier: true },
      });
      if (!resolvedIncomingInvoice)
        throw new Error("IncomingInvoice introuvable");
      if (!resolvedIncomingInvoice.supplierId)
        throw new Error("Compte fournisseur manquant (supplierId)");
      resolvedSupplierId = resolvedIncomingInvoice.supplierId;
    }

    const movement = await tx.moneyMovement.create({
      data: {
        companyId,
        moneyAccountId,
        amount: new Prisma.Decimal(amount),
        direction,
        kind,
        description,
        invoiceId,
        incomingInvoiceId,
        supplierId: resolvedSupplierId,
        voucherRef: finalVoucherRef,
      },
    });

    if (autoPost) {
      await autoPostTransactions({
        tx,
        movement,
        moneyAccount,
        amount,
        direction,
        kind,
        invoiceId,
        incomingInvoiceId,
        counterpartAccountId,
        vatBreakdown,
        incomingInvoice: resolvedIncomingInvoice,
        companyId,
      });
      if (invoiceId)
        await updateInvoiceSettlementStatus(tx, invoiceId, companyId);
      if (incomingInvoiceId)
        await updateIncomingInvoiceSettlementStatus(
          tx,
          incomingInvoiceId,
          companyId
        );
    }
    return movement;
  });
}

// Génère un numéro de compte comptable pour un compte de trésorerie si absent.
// Convention simple:
//  - Banque: prefix 512 + compteur sur 3 digits (512001, 512002 ...)
//  - Caisse: prefix 53  + compteur sur 3 digits (53001, 53002 ...) => mais pour homogénéité on garde 53001 style (prefix '53').
export async function ensureLedgerAccountForMoneyAccount(
  moneyAccount,
  companyId = null
) {
  const isBank = moneyAccount.type === "BANK";
  const prefix = isBank ? "521" : "571";
  // Récupère tous les comptes existants qui matchent le prefix exact 6 digits style 521100 / 571100 etc.
  const existing = await prisma.account.findMany({
    where: { number: { startsWith: prefix }, ...(companyId ? { companyId } : {}) },
    select: { id: true, number: true },
  });
  // Extract trailing 3 digits if pattern matches prefix + 3 digits.
  let maxTail = 0;
  for (const acc of existing) {
    if (acc.number.length === 6 && acc.number.startsWith(prefix)) {
      const tail = acc.number.substring(3); // e.g. '100'
      const num = parseInt(tail, 10);
      if (!isNaN(num) && num > maxTail) maxTail = num;
    }
  }
  // Les séquences progressent par paliers de 100: 100, 200, 300...
  const nextTail = maxTail === 0 ? 100 : maxTail + 100;
  const tailStr = String(nextTail).padStart(3, "0");
  const number = prefix + tailStr; // 521100, 521200 ... / 571100, 571200 ...
  let label;
  if (!isBank) {
    // CASH
    switch (nextTail) {
      case 100:
        label = "Caisse Monnaie locale";
        break;
      case 200:
        label = "Caisse Devise 1";
        break;
      case 300:
        label = "Caisse Devise 2";
        break;
      default:
        label = "Caisse " + (moneyAccount.label || tailStr);
        break;
    }
  } else {
    label = "Banque " + (moneyAccount.label || tailStr);
  }
  const account = await prisma.account.create({
    data: { number, label, companyId: companyId || null },
  });
  await prisma.moneyAccount.update({
    where: { id: moneyAccount.id },
    data: { ledgerAccountId: account.id },
  });
  return { account };
}

// Création d'un compte de trésorerie avec auto-provision du ledgerAccount.
export async function createMoneyAccount({
  companyId = null,
  type,
  label,
  code,
  currency = "EUR",
  openingBalance = 0,
}) {
  if (!["BANK", "CASH"].includes(type)) throw new Error("type invalide");
  if (!label) throw new Error("label requis");
  if (!companyId) throw new Error("companyId requis");
  const created = await prisma.moneyAccount.create({
    data: {
      companyId,
      type,
      label,
      code: code || null,
      currency,
      openingBalance: new Prisma.Decimal(openingBalance),
    },
  });
  // Auto ledger account
  await ensureLedgerAccountForMoneyAccount(created, companyId);
  return created;
}

export async function autoPostTransactions({
  tx,
  movement,
  moneyAccount,
  amount,
  direction,
  kind,
  invoiceId,
  incomingInvoiceId,
  counterpartAccountId,
  vatBreakdown,
  incomingInvoice,
  companyId = null,
}) {
  const entries = [];
  const amt = new Prisma.Decimal(amount);
  const defaultLabels = {
    ASSOCIATE_CONTRIBUTION: "Apport associé",
    ASSOCIATE_WITHDRAWAL: "Remboursement associé",
    SALARY_PAYMENT: "Paiement salaires",
    SALARY_ADVANCE: "Avance sur salaire",
  };
  // Ligne côté trésorerie (toujours)
  const moneyLine = {
    date: movement.date,
    amount: amt,
    direction: direction === "IN" ? "DEBIT" : "CREDIT",
    kind: "PAYMENT", // usage générique
    accountId: moneyAccount.ledgerAccountId,
    moneyMovementId: movement.id,
    description: movement.description || kind,
    invoiceId: invoiceId || null,
    incomingInvoiceId: incomingInvoiceId || null,
  };
  entries.push(moneyLine);

  // Déterminer contrepartie selon kind
  switch (kind) {
    case "CLIENT_RECEIPT": {
      if (!invoiceId) throw new Error("invoiceId requis pour CLIENT_RECEIPT");
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, ...(companyId ? { companyId } : {}) },
        include: { client: { include: { account: true } } },
      });
      if (!invoice) throw new Error("Facture introuvable");
      const clientAccountId = invoice.client?.accountId;
      if (!clientAccountId)
        throw new Error("Compte client non défini (client.accountId)");
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "CREDIT",
        kind: "RECEIVABLE",
        accountId: clientAccountId,
        moneyMovementId: movement.id,
        invoiceId,
        description: movement.description || "Encaissement client",
      });
      break;
    }
    case "SUPPLIER_PAYMENT": {
      const inc =
        incomingInvoice ||
        (await tx.incomingInvoice.findFirst({
          where: {
            id: incomingInvoiceId,
            ...(companyId ? { companyId } : {}),
          },
          include: { supplier: true },
        }));
      if (!inc) throw new Error("IncomingInvoice introuvable");
      const supplier = inc.supplier;
      if (!supplier?.accountId)
        throw new Error("Compte fournisseur non défini (supplier.accountId)");
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "DEBIT",
        kind: "PAYABLE",
        accountId: supplier.accountId,
        moneyMovementId: movement.id,
        incomingInvoiceId,
        description: movement.description || "Paiement fournisseur",
      });
      break;
    }
    case "CASH_PURCHASE": {
      // Permet ventilation multi-taux. Ex: vatBreakdown=[{rate:0.20, base:100},{rate:0.00, base:50}]
      if (
        !vatBreakdown ||
        !Array.isArray(vatBreakdown) ||
        !vatBreakdown.length
      ) {
        if (!counterpartAccountId)
          throw new Error(
            "counterpartAccountId requis pour CASH_PURCHASE (pas de vatBreakdown)"
          );
        entries.push({
          date: movement.date,
          amount: amt,
          direction: "DEBIT",
          kind: "PURCHASE",
          accountId: counterpartAccountId,
          moneyMovementId: movement.id,
          description: movement.description || "Achat cash",
        });
      } else {
        // On suppose counterpartAccountId est compte de charge par défaut si base non spécifie un mapping futur
        if (!counterpartAccountId)
          throw new Error(
            "counterpartAccountId requis pour CASH_PURCHASE avec vatBreakdown"
          );
        let totalFromBreakdown = new Prisma.Decimal(0);
        for (const seg of vatBreakdown) {
          const base = new Prisma.Decimal(seg.base);
          const rate = new Prisma.Decimal(seg.rate);
          const vat = base.mul(rate);
          totalFromBreakdown = totalFromBreakdown.plus(base).plus(vat);
          // Charge HT
          entries.push({
            date: movement.date,
            amount: base,
            direction: "DEBIT",
            kind: "PURCHASE",
            accountId: counterpartAccountId,
            moneyMovementId: movement.id,
            description:
              (movement.description || "Achat cash") +
              ` HT ${rate.mul(100).toString()}%`,
          });
          if (!rate.isZero()) {
            // TVA déductible - TODO: sélectionner compte TVA déductible générique (ex: via param)
            const vatAccount = await ensureVatDeductibleAccount(tx, companyId);
            entries.push({
              date: movement.date,
              amount: vat,
              direction: "DEBIT",
              kind: "VAT_DEDUCTIBLE",
              accountId: vatAccount.id,
              moneyMovementId: movement.id,
              description: "TVA déductible " + rate.mul(100).toString() + "%",
            });
          }
        }
        if (!totalFromBreakdown.eq(amt)) {
          throw new Error("Incohérence montant mouvement vs breakdown TVA");
        }
      }
      break;
    }
    case "VAT_PAYMENT":
    case "TAX_PAYMENT": {
      if (!counterpartAccountId)
        throw new Error("counterpartAccountId requis pour " + kind);
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "DEBIT",
        kind: kind === "VAT_PAYMENT" ? "VAT_COLLECTED" : "PAYMENT",
        accountId: counterpartAccountId,
        moneyMovementId: movement.id,
        description:
          movement.description ||
          (kind === "VAT_PAYMENT" ? "Paiement TVA" : "Paiement taxe"),
      });
      break;
    }
    case "TRANSFER": {
      // La contrepartie est portée par l'autre mouvement, on ne crée qu'une seule ligne ici.
      break;
    }
    case "ASSOCIATE_CONTRIBUTION": {
      if (!counterpartAccountId)
        throw new Error(
          "counterpartAccountId requis (compte courant associé 455)"
        );
      await ensureClass4Account(
        tx,
        counterpartAccountId,
        "ASSOCIATE_CONTRIBUTION",
        companyId
      );
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "CREDIT",
        kind: "PAYMENT",
        accountId: counterpartAccountId,
        moneyMovementId: movement.id,
        description: movement.description || defaultLabels[kind],
      });
      break;
    }
    case "ASSOCIATE_WITHDRAWAL": {
      if (!counterpartAccountId)
        throw new Error(
          "counterpartAccountId requis (compte courant associé 455)"
        );
      await ensureClass4Account(
        tx,
        counterpartAccountId,
        "ASSOCIATE_WITHDRAWAL",
        companyId
      );
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "DEBIT",
        kind: "PAYMENT",
        accountId: counterpartAccountId,
        moneyMovementId: movement.id,
        description: movement.description || defaultLabels[kind],
      });
      break;
    }
    case "SALARY_PAYMENT": {
      if (!counterpartAccountId)
        throw new Error("counterpartAccountId requis (compte 421 ou assimilé)");
      await ensureClass4Account(
        tx,
        counterpartAccountId,
        "SALARY_PAYMENT",
        companyId
      );
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "DEBIT",
        kind: "PAYMENT",
        accountId: counterpartAccountId,
        moneyMovementId: movement.id,
        description: movement.description || defaultLabels[kind],
      });
      break;
    }
    case "SALARY_ADVANCE": {
      if (!counterpartAccountId)
        throw new Error("counterpartAccountId requis (compte 425 / 467)");
      await ensureClass4Account(
        tx,
        counterpartAccountId,
        "SALARY_ADVANCE",
        companyId
      );
      entries.push({
        date: movement.date,
        amount: amt,
        direction: "DEBIT",
        kind: "PAYMENT",
        accountId: counterpartAccountId,
        moneyMovementId: movement.id,
        description: movement.description || defaultLabels[kind],
      });
      break;
    }
    default: {
      if (counterpartAccountId) {
        // Générique : sens opposé
        entries.push({
          date: movement.date,
          amount: amt,
          direction: direction === "IN" ? "CREDIT" : "DEBIT",
          kind: "PAYMENT",
          accountId: counterpartAccountId,
          moneyMovementId: movement.id,
          description: movement.description || kind,
        });
      }
    }
  }

  if (entries.length) {
    if (companyId) {
      entries.forEach((e) => {
        if (!e.companyId) e.companyId = companyId;
      });
    }
    await tx.transaction.createMany({ data: entries });
  }
}

export async function updateInvoiceSettlementStatus(
  tx,
  invoiceId,
  companyId = null
) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, ...(companyId ? { companyId } : {}) },
  });
  if (!invoice) return;
  const paidIn = await tx.moneyMovement.aggregate({
    where: {
      invoiceId,
      direction: "IN",
      ...(companyId ? { companyId } : {}),
    },
    _sum: { amount: true },
  });
  const paid = paidIn._sum.amount || new Prisma.Decimal(0);
  const outstanding = invoice.totalAmount.minus(paid);
  let newStatus = invoice.status;
  if (paid.gte(invoice.totalAmount)) newStatus = "PAID";
  else if (paid.gt(0)) newStatus = "PARTIAL";
  else newStatus = "PENDING";
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status: newStatus,
      paidAmount: paid,
      outstandingAmount: outstanding,
    },
  });
}

export async function updateIncomingInvoiceSettlementStatus(
  tx,
  incomingInvoiceId,
  companyId = null
) {
  const inc = await tx.incomingInvoice.findFirst({
    where: { id: incomingInvoiceId, ...(companyId ? { companyId } : {}) },
  });
  if (!inc) return;
  const paidOut = await tx.moneyMovement.aggregate({
    where: {
      incomingInvoiceId,
      direction: "OUT",
      ...(companyId ? { companyId } : {}),
    },
    _sum: { amount: true },
  });
  const paid = paidOut._sum.amount || new Prisma.Decimal(0);
  const outstanding = inc.totalAmount.minus(paid);
  let newStatus = inc.status;
  if (paid.gte(inc.totalAmount)) newStatus = "PAID";
  else if (paid.gt(0)) newStatus = "PARTIAL";
  else newStatus = "PENDING";
  await tx.incomingInvoice.update({
    where: { id: incomingInvoiceId },
    data: {
      status: newStatus,
      paidAmount: paid,
      outstandingAmount: outstanding,
    },
  });
}

async function ensureVatDeductibleAccount(tx, companyId = null) {
  // Simpliste: recherche premier compte TVA déductible (pattern 44566). Améliorer avec config.
  let acc = await tx.account.findFirst({
    where: {
      number: { startsWith: "44566" },
      ...(companyId ? { companyId } : {}),
    },
  });
  if (!acc) {
    acc = await tx.account.create({
      data: {
        number: "445660AUTO",
        label: "TVA déductible auto",
        companyId: companyId || null,
      },
    });
  }
  return acc;
}

async function ensureClass4Account(
  tx,
  accountId,
  context,
  companyId = null
) {
  const acc = await tx.account.findUnique({ where: { id: accountId } });
  if (!acc) throw new Error("Compte contrepartie introuvable");
  if (companyId && acc.companyId !== companyId) {
    throw new Error("Compte contrepartie hors société");
  }
  if (!acc.number || !acc.number.startsWith("4")) {
    throw new Error(
      `Le compte ${
        acc.number || ""
      } n'appartient pas à la classe 4 requis pour ${context}`
    );
  }
  return acc;
}

export async function computeMoneyAccountBalance(moneyAccountId, companyId = null) {
  const account = await prisma.moneyAccount.findFirst({
    where: { id: moneyAccountId, ...(companyId ? { companyId } : {}) },
    include: { movements: { select: { amount: true, direction: true } } },
  });
  if (!account) throw new Error("MoneyAccount introuvable");
  const opening = new Prisma.Decimal(account.openingBalance || 0);
  const delta = account.movements.reduce((acc, m) => {
    return m.direction === "IN" ? acc.plus(m.amount) : acc.minus(m.amount);
  }, new Prisma.Decimal(0));
  return opening.plus(delta);
}

export async function listMoneyAccountsWithBalance(companyId = null) {
  const accounts = await prisma.moneyAccount.findMany({
    where: companyId ? { companyId } : undefined,
    include: { ledgerAccount: true },
  });
  const result = [];
  for (const acc of accounts) {
    const sums = await prisma.moneyMovement.groupBy({
      by: ["direction"],
      where: { moneyAccountId: acc.id, ...(companyId ? { companyId } : {}) },
      _sum: { amount: true },
    });
    let bal = new Prisma.Decimal(acc.openingBalance || 0);
    for (const row of sums) {
      const s = row._sum.amount || new Prisma.Decimal(0);
      bal = row.direction === "IN" ? bal.plus(s) : bal.minus(s);
    }
    result.push({
      ...acc,
      computedBalance: bal,
    });
  }
  return result;
}

export async function listMoneyMovements({
  companyId = null,
  moneyAccountId,
  supplierId,
  incomingInvoiceId,
  invoiceId,
  direction,
  kind,
  limit = 50,
  cursor,
}) {
  if (!moneyAccountId) throw new Error("moneyAccountId requis");
  if (!companyId) throw new Error("companyId requis");
  const where = { moneyAccountId, ...(companyId ? { companyId } : {}) };
  if (supplierId) where.supplierId = supplierId;
  if (incomingInvoiceId) where.incomingInvoiceId = incomingInvoiceId;
  if (invoiceId) where.invoiceId = invoiceId;
  if (direction && ["IN", "OUT"].includes(direction))
    where.direction = direction;
  if (kind) where.kind = kind;
  const take = limit;
  const query = {
    where,
    orderBy: { date: "desc" },
    take: take + 1,
    include: {
      moneyAccount: { select: { label: true, id: true } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          client: { select: { name: true } },
        },
      },
      incomingInvoice: {
        select: {
          id: true,
          entryNumber: true,
          supplierInvoiceNumber: true,
          supplier: { select: { name: true } },
        },
      },
      supplier: { select: { id: true, name: true } },
      transactions: { include: { account: true } },
    },
  };
  if (cursor) (query.skip = 1), (query.cursor = { id: cursor });
  const rows = await prisma.moneyMovement.findMany(query);
  let nextCursor = null;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next.id;
  }
  return { rows, nextCursor };
}

// Ledger-style helper: opening balance + movements (ascending) + totals + closing balance.
export async function getMoneyAccountLedger({
  moneyAccountId,
  limit = 200,
  dateFrom,
  dateTo,
  companyId = null,
}) {
  const account = await prisma.moneyAccount.findFirst({
    where: { id: moneyAccountId, ...(companyId ? { companyId } : {}) },
    include: { ledgerAccount: true },
  });
  if (!account) throw new Error("Compte trésorerie introuvable");
  const baseOpening = new Prisma.Decimal(account.openingBalance || 0);

  // Normalise & validate date range
  let fromDate = dateFrom ? new Date(dateFrom) : null;
  let toDate = dateTo ? new Date(dateTo) : null;
  if (fromDate && isNaN(fromDate.getTime())) fromDate = null;
  if (toDate && isNaN(toDate.getTime())) toDate = null;
  if (fromDate && toDate && fromDate > toDate) {
    // swap
    const tmp = fromDate;
    fromDate = toDate;
    toDate = tmp;
  }

  // Compute effective opening at fromDate (base + all movements strictly before fromDate)
  let effectiveOpening = baseOpening;
  if (fromDate) {
    const beforeGrouped = await prisma.moneyMovement.groupBy({
      by: ["direction"],
      where: { moneyAccountId, date: { lt: fromDate }, ...(companyId ? { companyId } : {}) },
      _sum: { amount: true },
    });
    for (const g of beforeGrouped) {
      const s = g._sum.amount || new Prisma.Decimal(0);
      effectiveOpening =
        g.direction === "IN"
          ? effectiveOpening.plus(s)
          : effectiveOpening.minus(s);
    }
  }

  // Period filter for totals
  const periodWhere = { moneyAccountId, ...(companyId ? { companyId } : {}) };
  if (fromDate || toDate) {
    periodWhere.date = {};
    if (fromDate) periodWhere.date.gte = fromDate;
    if (toDate) {
      // ensure toDate includes full day (set to 23:59:59.999)
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      periodWhere.date.lte = end;
      toDate = end; // use extended
    }
  }

  const grouped = await prisma.moneyMovement.groupBy({
    by: ["direction"],
    where: periodWhere,
    _sum: { amount: true },
  });
  let totalIn = new Prisma.Decimal(0),
    totalOut = new Prisma.Decimal(0);
  for (const g of grouped) {
    const s = g._sum.amount || new Prisma.Decimal(0);
    if (g.direction === "IN") totalIn = totalIn.plus(s);
    else totalOut = totalOut.plus(s);
  }

  // Movements within period for display
  const movements = await prisma.moneyMovement.findMany({
    where: periodWhere,
    orderBy: { date: "asc" },
    take: limit,
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
      incomingInvoice: { select: { id: true, entryNumber: true } },
      supplier: { select: { id: true, name: true } },
      transactions: { include: { account: true } },
    },
  });

  let running = effectiveOpening;
  const enriched = movements.map((m) => {
    running =
      m.direction === "IN" ? running.plus(m.amount) : running.minus(m.amount);
    return {
      id: m.id,
      date: m.date,
      direction: m.direction,
      kind: m.kind,
      description: m.description || "",
      amount: m.amount.toString(),
      voucherRef: m.voucherRef,
      invoice: m.invoice
        ? { id: m.invoice.id, number: m.invoice.invoiceNumber }
        : null,
      incomingInvoice: m.incomingInvoice
        ? { id: m.incomingInvoice.id, number: m.incomingInvoice.entryNumber }
        : null,
      supplier: m.supplier
        ? { id: m.supplier.id, name: m.supplier.name }
        : null,
      transactions: (m.transactions || []).map((t) => ({
        id: t.id,
        accountId: t.accountId,
        accountNumber: t.account?.number,
        accountLabel: t.account?.label,
        debit: t.direction === "DEBIT" ? t.amount.toString() : null,
        credit: t.direction === "CREDIT" ? t.amount.toString() : null,
      })),
      balanceAfter: running.toString(),
    };
  });
  // Determine if truncated (period aware)
  const totalPeriodCount = await prisma.moneyMovement.count({
    where: periodWhere,
  });
  const truncated = totalPeriodCount > movements.length;

  const closing = effectiveOpening.plus(totalIn).minus(totalOut);
  return {
    account: {
      id: account.id,
      label: account.label,
      type: account.type,
      currency: account.currency,
      ledgerAccountId: account.ledgerAccountId,
    },
    openingBalance: effectiveOpening.toString(),
    baseOpeningBalance: baseOpening.toString(),
    filter: fromDate || toDate ? { from: fromDate, to: toDate } : null,
    totalIn: totalIn.toString(),
    totalOut: totalOut.toString(),
    closingBalance: closing.toString(),
    movements: enriched,
    limited: truncated,
  };
}

export async function createTransfer({
  companyId = null,
  fromMoneyAccountId,
  toMoneyAccountId,
  amount,
  description,
  voucherRef,
}) {
  if (!companyId) throw new Error("companyId requis");
  if (fromMoneyAccountId === toMoneyAccountId)
    throw new Error("Comptes identiques");
  if (!amount || Number(amount) <= 0) throw new Error("Montant > 0 requis");
  // Anciennement transferGroupId : supprimé du schéma.
  // Comme voucherRef est UNIQUE, on génère un baseRef puis deux refs dérivées (baseRef-1 / baseRef-2)
  // baseRef sert de groupement logique (groupRef)
  return await prisma.$transaction(async (tx) => {
    const from = await tx.moneyAccount.findUnique({
      where: { id: fromMoneyAccountId },
      include: { ledgerAccount: true },
    });
    const to = await tx.moneyAccount.findUnique({
      where: { id: toMoneyAccountId },
      include: { ledgerAccount: true },
    });
    if (!from || !to)
      throw new Error("Compte source ou destination introuvable");
    if (from.companyId !== companyId || to.companyId !== companyId) {
      throw new Error("Comptes trésorerie hors société");
    }
    if (!from.ledgerAccountId || !to.ledgerAccountId)
      throw new Error("ledgerAccountId manquant sur un compte");

    // Génération baseRef
    let baseRef = voucherRef;
    if (!baseRef) {
      const seqNum = await nextSequence("TRANSFER");
      baseRef = formatVoucher("TRF", new Date(), seqNum);
    }
    const outRef = baseRef + "-1";
    const inRef = baseRef + "-2";
    // Sortie
    const outMv = await tx.moneyMovement.create({
      data: {
        companyId,
        moneyAccountId: fromMoneyAccountId,
        amount: new Prisma.Decimal(amount),
        direction: "OUT",
        kind: "TRANSFER",
        description,
        voucherRef: outRef,
      },
    });
    // Entrée
    const inMv = await tx.moneyMovement.create({
      data: {
        companyId,
        moneyAccountId: toMoneyAccountId,
        amount: new Prisma.Decimal(amount),
        direction: "IN",
        kind: "TRANSFER",
        description,
        voucherRef: inRef,
      },
    });

    // Écritures : Crédit source, Débit destination
    await tx.transaction.createMany({
      data: [
        {
          date: outMv.date,
          amount: new Prisma.Decimal(amount),
          direction: "CREDIT",
          kind: "PAYMENT",
          accountId: from.ledgerAccountId,
          moneyMovementId: outMv.id,
          description: description || "Transfert sortant",
          companyId,
        },
        {
          date: inMv.date,
          amount: new Prisma.Decimal(amount),
          direction: "DEBIT",
          kind: "PAYMENT",
          accountId: to.ledgerAccountId,
          moneyMovementId: inMv.id,
          description: description || "Transfert entrant",
          companyId,
        },
      ],
    });
    return {
      out: outMv,
      in: inMv,
      groupRef: baseRef,
      baseRef,
      outVoucherRef: outRef,
      inVoucherRef: inRef,
    };
  });
}

export async function getSupplierTreasuryOverview({
  companyId = null,
  search,
  limit = 25,
} = {}) {
  if (!companyId) throw new Error("companyId requis");
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const suppliers = await prisma.supplier.findMany({
    where: { ...where, companyId },
    orderBy: { name: "asc" },
    take: limit,
    include: {
      account: { select: { number: true } },
      incomingInvoices: {
        where: {
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          companyId,
        },
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          entryNumber: true,
          supplierInvoiceNumber: true,
          dueDate: true,
          totalAmount: true,
          outstandingAmount: true,
          status: true,
        },
      },
      moneyMovements: {
        where: { kind: "SUPPLIER_PAYMENT", companyId },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          date: true,
          amount: true,
          voucherRef: true,
          moneyAccount: { select: { label: true } },
        },
      },
    },
  });
  const today = new Date();
  return suppliers.map((supplier) => {
    let outstandingTotal = 0;
    let overdueCount = 0;
    let nextDueDate = null;
    const mappedInvoices = supplier.incomingInvoices.map((invoice) => {
      const total =
        invoice.totalAmount?.toNumber?.() ?? Number(invoice.totalAmount ?? 0);
      const outstanding =
        invoice.outstandingAmount?.toNumber?.() ??
        Number(invoice.outstandingAmount ?? 0);
      outstandingTotal += outstanding;
      const due = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const isOverdue =
        outstanding > 0 &&
        (invoice.status === "OVERDUE" || (due && due < today));
      if (isOverdue) overdueCount += 1;
      if (outstanding > 0) {
        if (!nextDueDate || (due && due < nextDueDate)) {
          nextDueDate = due || nextDueDate;
        }
      }
      return {
        id: invoice.id,
        number: invoice.entryNumber || invoice.supplierInvoiceNumber || "—",
        dueDate: due ? due.toISOString() : null,
        total,
        outstanding,
        status: invoice.status,
        isOverdue,
      };
    });
    const invoicesLimited = mappedInvoices.length > 5;
    const invoices = invoicesLimited
      ? mappedInvoices.slice(0, 5)
      : mappedInvoices;

    const payments = supplier.moneyMovements.map((movement) => ({
      id: movement.id,
      date: movement.date ? movement.date.toISOString() : null,
      amount: movement.amount?.toNumber?.() ?? Number(movement.amount ?? 0),
      voucherRef: movement.voucherRef,
      moneyAccountLabel: movement.moneyAccount?.label || null,
    }));

    return {
      id: supplier.id,
      name: supplier.name,
      accountNumber: supplier.account?.number || null,
      paymentDelay: supplier.paymentDelay ?? null,
      outstandingTotal,
      overdueCount,
      nextDueDate: nextDueDate ? nextDueDate.toISOString() : null,
      invoices,
      payments,
      invoicesLimited,
    };
  });
}

export async function getSupplierTreasuryDetail({
  companyId = null,
  supplierId,
  paymentLimit = 100,
} = {}) {
  if (!supplierId) throw new Error("supplierId requis");
  if (!companyId) throw new Error("companyId requis");
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: {
      account: { select: { number: true, label: true } },
    },
  });
  if (!supplier) return null;

  const invoices = await prisma.incomingInvoice.findMany({
    where: { supplierId, companyId },
    orderBy: [{ status: "desc" }, { dueDate: "asc" }],
    select: {
      id: true,
      entryNumber: true,
      supplierInvoiceNumber: true,
      issueDate: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      outstandingAmount: true,
      status: true,
    },
  });

  const payments = await prisma.moneyMovement.findMany({
    where: { supplierId, kind: "SUPPLIER_PAYMENT", companyId },
    orderBy: { date: "desc" },
    take: paymentLimit,
    include: {
      moneyAccount: { select: { id: true, label: true, code: true } },
      incomingInvoice: {
        select: {
          id: true,
          entryNumber: true,
          supplierInvoiceNumber: true,
        },
      },
      transactions: {
        include: { account: true },
      },
    },
  });

  const decimalToNumber = (value) => value?.toNumber?.() ?? Number(value ?? 0);
  const today = new Date();

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let overdueCount = 0;
  let nextDueDate = null;

  const invoiceRows = invoices.map((invoice) => {
    const total = decimalToNumber(invoice.totalAmount);
    const paid = decimalToNumber(invoice.paidAmount);
    const outstanding = decimalToNumber(invoice.outstandingAmount);
    totalInvoiced += total;
    totalPaid += paid;
    totalOutstanding += outstanding;
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const isOverdue =
      outstanding > 0 &&
      (invoice.status === "OVERDUE" || (dueDate && dueDate < today));
    if (isOverdue) overdueCount += 1;
    if (outstanding > 0 && dueDate) {
      if (!nextDueDate || dueDate < nextDueDate) nextDueDate = dueDate;
    }
    return {
      id: invoice.id,
      number:
        invoice.entryNumber || invoice.supplierInvoiceNumber || invoice.id,
      issueDate: invoice.issueDate ? invoice.issueDate.toISOString() : null,
      dueDate: dueDate ? dueDate.toISOString() : null,
      status: invoice.status,
      total,
      paid,
      outstanding,
      isOverdue,
    };
  });

  const paymentRows = payments.map((movement) => ({
    id: movement.id,
    date: movement.date ? movement.date.toISOString() : null,
    amount: decimalToNumber(movement.amount),
    description: movement.description || "",
    voucherRef: movement.voucherRef,
    moneyAccount: movement.moneyAccount
      ? {
          id: movement.moneyAccount.id,
          label: movement.moneyAccount.label,
          code: movement.moneyAccount.code,
        }
      : null,
    incomingInvoice: movement.incomingInvoice
      ? {
          id: movement.incomingInvoice.id,
          number:
            movement.incomingInvoice.entryNumber ||
            movement.incomingInvoice.supplierInvoiceNumber ||
            movement.incomingInvoice.id,
        }
      : null,
    transactions: (movement.transactions || []).map((t) => ({
      id: t.id,
      direction: t.direction,
      accountId: t.accountId,
      accountNumber: t.account?.number,
      accountLabel: t.account?.label,
      amount: decimalToNumber(t.amount),
    })),
  }));

  const timelineEvents = [];
  for (const invoice of invoiceRows) {
    const referenceDate = invoice.issueDate || invoice.dueDate;
    if (!referenceDate) continue;
    timelineEvents.push({
      type: "INVOICE",
      id: invoice.id,
      date: referenceDate,
      label: invoice.number,
      delta: new Prisma.Decimal(invoice.total),
      meta: {
        dueDate: invoice.dueDate,
        outstanding: invoice.outstanding,
        status: invoice.status,
      },
    });
  }
  for (const payment of paymentRows) {
    if (!payment.date) continue;
    timelineEvents.push({
      type: "PAYMENT",
      id: payment.id,
      date: payment.date,
      label: payment.voucherRef || payment.description || payment.id,
      delta: new Prisma.Decimal(payment.amount || 0).times(-1),
      meta: {
        invoiceNumber: payment.incomingInvoice?.number || null,
        voucherRef: payment.voucherRef || null,
      },
    });
  }

  timelineEvents.sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    if (da.getTime() === db.getTime()) {
      if (a.type === b.type) return a.id.localeCompare(b.id);
      return a.type === "INVOICE" ? -1 : 1;
    }
    return da - db;
  });

  let running = new Prisma.Decimal(0);
  const timeline = timelineEvents.map((event) => {
    running = running.plus(event.delta);
    return {
      id: event.id,
      type: event.type,
      date: event.date,
      label: event.label,
      delta: event.delta.toString(),
      balanceAfter: running.toString(),
      meta: event.meta,
    };
  });

  const lastPaymentDate = paymentRows[0]?.date || null;

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      accountNumber: supplier.account?.number || null,
      accountLabel: supplier.account?.label || null,
      paymentDelay: supplier.paymentDelay,
    },
    summary: {
      invoiceCount: invoices.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      overdueCount,
      nextDueDate: nextDueDate ? nextDueDate.toISOString() : null,
      lastPaymentDate,
    },
    invoices: invoiceRows,
    payments: paymentRows,
    paymentsLimited: payments.length >= paymentLimit,
    timeline,
  };
}
