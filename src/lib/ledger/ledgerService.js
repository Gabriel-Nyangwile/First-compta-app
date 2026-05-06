import prisma from "../../lib/prisma.js";
import { validateLedgerFilters } from "./ledgerFilters.js";
import {
  calculateAccountAggregates,
  filterAccounts,
  calculateGlobalTotals,
  toNumber
} from "./ledgerCalculations.js";

/**
 * Récupère les données du grand livre
 */
export async function getLedgerData(companyId, rawFilters = {}) {
  const filters = validateLedgerFilters(rawFilters);
  const { dateFrom, dateTo, q, letterStatus, direction, includeZero } = filters;

  // Recherche des comptes
  const accountWhere = q
    ? {
        companyId,
        OR: [
          { number: { contains: q } },
          { label: { contains: q, mode: "insensitive" } },
          {
            transactions: {
              some: {
                OR: [
                  { description: { contains: q, mode: "insensitive" } },
                  { letterRef: { contains: q, mode: "insensitive" } },
                  { journalEntry: { number: { contains: q, mode: "insensitive" } } },
                  { journalEntry: { sourceId: { contains: q, mode: "insensitive" } } },
                  { journalEntry: { supportRef: { contains: q, mode: "insensitive" } } },
                  { invoice: { invoiceNumber: { contains: q, mode: "insensitive" } } },
                  { incomingInvoice: { entryNumber: { contains: q, mode: "insensitive" } } },
                  { moneyMovement: { voucherRef: { contains: q, mode: "insensitive" } } },
                ],
              },
            },
          },
        ],
      }
    : { companyId };

  const accounts = await prisma.account.findMany({
    where: accountWhere,
    select: { id: true, number: true, label: true },
    orderBy: { number: "asc" },
  });

  if (!accounts.length) {
    return {
      accounts: [],
      totals: {
        totalDebit: 0,
        totalCredit: 0,
        totalLettered: 0,
        totalOutstanding: 0,
      },
      filters,
    };
  }

  const accountIds = accounts.map((account) => account.id);

  // Conditions WHERE pour les transactions
  const whereConditions = [
    { companyId },
    { accountId: { in: accountIds } }
  ];

  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    whereConditions.push({ date: range });
  }

  if (letterStatus) whereConditions.push({ letterStatus });
  if (direction) whereConditions.push({ direction });

  const where = { AND: whereConditions };

  // Récupération des agrégats
  const [directionGroups, totalsByAccount, statusGroups] = await Promise.all([
    prisma.transaction.groupBy({
      where,
      by: ["accountId", "direction"],
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      where,
      by: ["accountId"],
      _sum: { amount: true, letteredAmount: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      where,
      by: ["accountId", "letterStatus"],
      _count: { _all: true },
    }),
  ]);

  // Calcul des agrégats
  const accountMap = calculateAccountAggregates(directionGroups, totalsByAccount, statusGroups, accounts);

  // Filtrage et calcul des totaux
  const rows = filterAccounts(accounts, accountMap, includeZero);
  const totals = calculateGlobalTotals(rows);

  return {
    accounts: rows,
    totals,
    filters,
  };
}

/**
 * Récupère les transactions d'un compte spécifique
 */
export async function getAccountTransactions(companyId, accountId, rawFilters = {}) {
  const filters = validateLedgerFilters(rawFilters);
  const { page, pageSize, dateFrom, dateTo, letterStatus, direction, q } = filters;

  // Vérifier que le compte existe et appartient à la company
  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId },
    select: { id: true, number: true, label: true },
  });

  if (!account) {
    throw new Error("Compte non trouvé");
  }

  // Conditions WHERE
  const whereConditions = [{ companyId }, { accountId }];

  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    whereConditions.push({ date: range });
  }

  if (letterStatus) whereConditions.push({ letterStatus });
  if (direction) whereConditions.push({ direction });

  if (q) {
    const like = { contains: q, mode: "insensitive" };
    whereConditions.push({
      OR: [
        { description: like },
        { letterRef: like },
        { journalEntry: { number: like } },
        { journalEntry: { sourceId: like } },
        { invoice: { invoiceNumber: like } },
        { incomingInvoice: { entryNumber: like } },
        { client: { name: like } },
        { supplier: { name: like } },
        { moneyMovement: { voucherRef: like } },
      ],
    });
  }

  const where = { AND: whereConditions };

  // Compter le total
  const totalCount = await prisma.transaction.count({ where });

  // Récupérer les transactions
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      journalEntry: {
        select: {
          id: true,
          number: true,
          date: true,
          sourceType: true,
          sourceId: true,
        },
      },
      client: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      incomingInvoice: { select: { id: true, entryNumber: true } },
      moneyMovement: {
        select: { id: true, voucherRef: true, kind: true },
      },
    },
  });

  // Calculer les totaux de la page
  let pageDebit = 0;
  let pageCredit = 0;
  let pageLettered = 0;
  let pageOutstanding = 0;

  const rows = transactions.map((tx) => {
    const amount = toNumber(tx.amount);
    const letteredAmount = toNumber(tx.letteredAmount);
    const outstanding = Math.max(0, amount - letteredAmount);

    const debit = tx.direction === "DEBIT" ? amount : 0;
    const credit = tx.direction === "CREDIT" ? amount : 0;

    pageDebit += debit;
    pageCredit += credit;
    pageLettered += letteredAmount;
    pageOutstanding += outstanding;

    return {
      ...tx,
      amount,
      debit,
      credit,
      letteredAmount,
      outstanding,
      letterStatus: tx.letterStatus || "UNMATCHED",
    };
  });

  // Récupérer les totaux globaux pour ce compte
  const [globalDirectionGroups, globalTotals] = await Promise.all([
    prisma.transaction.groupBy({
      where: { AND: whereConditions },
      by: ["direction"],
      _sum: { amount: true, letteredAmount: true },
    }),
    prisma.transaction.groupBy({
      where: { AND: whereConditions },
      by: ["letterStatus"],
      _count: { letterStatus: true },
    }),
  ]);

  let totalDebit = 0;
  let totalCredit = 0;
  let totalLettered = 0;
  let totalOutstanding = 0;

  globalDirectionGroups.forEach((item) => {
    const amount = toNumber(item._sum.amount);
    const letteredAmount = toNumber(item._sum.letteredAmount);
    if (item.direction === "DEBIT") totalDebit += amount;
    else totalCredit += amount;
    totalLettered += letteredAmount;
    totalOutstanding += Math.max(0, amount - letteredAmount);
  });

  const letterStatusCounts = Object.fromEntries(
    globalTotals.map((item) => [
      item.letterStatus || "UNMATCHED",
      item._count.letterStatus,
    ])
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    account,
    transactions: rows,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    pageTotals: {
      debit: pageDebit,
      credit: pageCredit,
      lettered: pageLettered,
      outstanding: pageOutstanding,
    },
    globalTotals: {
      debit: totalDebit,
      credit: totalCredit,
      lettered: totalLettered,
      outstanding: totalOutstanding,
    },
    letterStatusCounts,
    filters,
  };
}
