import { z } from 'zod';

// Enums from Prisma
const JournalSourceTypeEnum = z.enum([
  'INVOICE',
  'INCOMING_INVOICE',
  'PAYMENT',
  'BANK_STATEMENT',
  'ADJUSTMENT',
  'OPENING_BALANCE',
  'CLOSING',
  'OTHER'
]);

const JournalStatusEnum = z.enum([
  'DRAFT',
  'POSTED',
  'CANCELLED'
]);

const TransactionLetterStatusEnum = z.enum([
  'UNMATCHED',
  'PARTIAL',
  'MATCHED'
]);

// Base filter schema
export const JournalFiltersSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(20),

  // Date filters
  dateFrom: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Date invalide"),
  dateTo: z.string().optional().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Date invalide"),

  // Source filters
  sourceType: JournalSourceTypeEnum.optional(),
  status: JournalStatusEnum.optional(),
  number: z.string().max(50).optional(),
  sourceId: z.string().max(100).optional(),

  // Account filter
  accountNumber: z.string().max(20).optional(),

  // Lettrage filter
  letterStatus: TransactionLetterStatusEnum.optional(),

  // Search
  q: z.string().max(200).optional(),
}).refine((data) => {
  // Date validation: dateFrom should be before dateTo
  if (data.dateFrom && data.dateTo) {
    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    return from <= to;
  }
  return true;
}, {
  message: "La date de début doit être antérieure à la date de fin",
  path: ["dateFrom"]
});

// Export types
/**
 * @typedef {Object} JournalFilters
 * @property {number} page
 * @property {number} pageSize
 * @property {string} [dateFrom]
 * @property {string} [dateTo]
 * @property {string} [sourceType]
 * @property {string} [status]
 * @property {string} [number]
 * @property {string} [sourceId]
 * @property {string} [accountNumber]
 * @property {string} [letterStatus]
 * @property {string} [q]
 */

// Default values
const DEFAULT_JOURNAL_FILTERS = {
  page: 1,
  pageSize: 20,
};

// Validation helper
export function validateJournalFilters(data) {
  return JournalFiltersSchema.parse(data);
}

// Safe validation (returns default on error)
export function safeValidateJournalFilters(data) {
  try {
    return validateJournalFilters(data);
  } catch {
    return DEFAULT_JOURNAL_FILTERS;
  }
}