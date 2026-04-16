import prisma from "../../lib/prisma.js";
import { validateJournalFilters } from "./journalFilters.js";
import { calculateJournalEntryTotals } from "./journalCalculations.js";

/**
 * Récupère les écritures journal avec filtres et pagination
 */
export async function getJournalEntries(companyId, rawFilters = {}) {
  // Valider et nettoyer les filtres
  const filters = validateJournalFilters(rawFilters);
  const { page, pageSize, dateFrom, dateTo, sourceType, status, number, sourceId, accountNumber, letterStatus, q } = filters;

  // Construire les conditions WHERE
  const whereConditions = [{ companyId }];

  if (sourceType) whereConditions.push({ sourceType });
  if (status) whereConditions.push({ status });
  if (number) {
    whereConditions.push({ number: { contains: number, mode: "insensitive" } });
  }
  if (sourceId) {
    whereConditions.push({ sourceId: { contains: sourceId, mode: "insensitive" } });
  }

  // Filtre de date
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

  // Filtre par compte
  if (accountNumber) {
    whereConditions.push({
      lines: {
        some: {
          account: {
            number: { contains: accountNumber, mode: "insensitive" },
          },
        },
      },
    });
  }

  // Filtre par statut de lettrage
  if (letterStatus) {
    whereConditions.push({ lines: { some: { letterStatus } } });
  }

  // Recherche globale
  if (q) {
    const like = { contains: q, mode: "insensitive" };
    whereConditions.push({
      OR: [
        { number: like },
        { description: like },
        { sourceId: like },
        {
          lines: {
            some: {
              OR: [
                { description: like },
                { letterRef: like },
                { account: { number: { contains: q } } },
                { account: { label: like } },
              ],
            },
          },
        },
      ],
    });
  }

  const where = whereConditions.length ? { AND: whereConditions } : undefined;

  // Compter le total
  const totalCount = await prisma.journalEntry.count({ where });

  // Récupérer les écritures
  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ date: "desc" }, { number: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      lines: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        include: {
          account: { select: { id: true, number: true, label: true } },
        },
      },
    },
  });

  // Calculer les totaux pour chaque écriture
  const items = entries.map((entry) => {
    const totals = calculateJournalEntryTotals(entry.lines);
    return {
      id: entry.id,
      number: entry.number,
      date: entry.date,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      description: entry.description,
      status: entry.status,
      postedAt: entry.postedAt,
      ...totals,
    };
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    items,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    filters,
  };
}

/**
 * Récupère une écriture journal par ID
 */
export async function getJournalEntryById(companyId, entryId) {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, companyId },
    include: {
      lines: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        include: {
          account: { select: { id: true, number: true, label: true } },
          client: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          incomingInvoice: { select: { id: true, entryNumber: true } },
          moneyMovement: { select: { id: true, voucherRef: true, kind: true } },
        },
      },
    },
  });

  if (!entry) return null;

  const totals = calculateJournalEntryTotals(entry.lines);

  return {
    ...entry,
    ...totals,
  };
}