// Shared client & invoice related helpers

export const VALID_CLIENT_CATEGORIES = ['CASH', 'DAYS_15', 'DAYS_30', 'DAYS_45'];

export function validateCategory(category, fallback = 'DAYS_30') {
  if (!category) return fallback;
  return VALID_CLIENT_CATEGORIES.includes(category) ? category : fallback;
}

export function normalizeEmail(email) {
  if (!email && email !== '') return null;
  const cleaned = String(email).trim().toLowerCase();
  return cleaned === '' ? null : cleaned;
}

export function getPaymentDays(category) {
  switch (category) {
    case 'CASH': return 0;
    case 'DAYS_15': return 15;
    case 'DAYS_30': return 30;
    case 'DAYS_45': return 45;
    default: return 30;
  }
}
