import { z } from 'zod';

// Normalisation d'une valeur de query string
const normalizeQueryValue = (value) => {
  if (Array.isArray(value)) return value[0];
  if (value === "") return undefined;
  return value;
};

// Enums from Prisma
const TransactionLetterStatusEnum = z.enum([
  'UNMATCHED',
  'PARTIAL',
  'MATCHED'
]);

const TransactionDirectionEnum = z.enum([
  'DEBIT',
  'CREDIT'
]);

// Base filter schema for ledger
export const LedgerFiltersSchema = z.object({
  // Date filters
  dateFrom: z.preprocess(normalizeQueryValue, z.string().optional()).refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Date invalide"),
  dateTo: z.preprocess(normalizeQueryValue, z.string().optional()).refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Date invalide"),

  // Search
  q: z.preprocess(normalizeQueryValue, z.string().max(200).optional()),

  // Lettrage filter
  letterStatus: z.preprocess(normalizeQueryValue, z.union([TransactionLetterStatusEnum, z.undefined()])),

  // Direction filter
  direction: z.preprocess(normalizeQueryValue, z.union([TransactionDirectionEnum, z.undefined()])),

  // Display options
  includeZero: z.preprocess(normalizeQueryValue, z.coerce.boolean().default(true)),

  // Pagination for account details
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
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
 * @typedef {Object} LedgerFilters
 * @property {string} [dateFrom]
 * @property {string} [dateTo]
 * @property {string} [q]
 * @property {string} [letterStatus]
 * @property {string} [direction]
 * @property {boolean} includeZero
 * @property {number} page
 * @property {number} pageSize
 */

// Default values
const DEFAULT_LEDGER_FILTERS = {
  includeZero: true,
  page: 1,
  pageSize: 50,
};

// Validation helper
export function validateLedgerFilters(data) {
  return LedgerFiltersSchema.parse(data);
}

// Safe validation (returns default on error)
export function safeValidateLedgerFilters(data) {
  try {
    return validateLedgerFilters(data);
  } catch {
    return DEFAULT_LEDGER_FILTERS;
  }
}