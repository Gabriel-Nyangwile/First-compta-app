// Shared utility to convert Prisma Decimal instances, Date objects and nested structures
// into plain JSON-serializable primitives safe for passing to Client Components.
// - Decimal -> number via toNumber()
// - Date -> ISO string (preserve temporal info without complex object)
// - Arrays / Objects recurse
// - Other primitives returned unchanged
// Avoids leaking class instances/functions into React Server -> Client boundary.

export function sanitizePlain(value) {
  if (value == null) return value;
  if (typeof value === 'object') {
    // Prisma Decimal detection
    if (typeof value.toNumber === 'function' && Object.keys(value).length === 0) {
      // Some Decimal objects appear as empty object with toNumber
      try { return value.toNumber(); } catch { /* fallthrough */ }
    }
    if (typeof value.toNumber === 'function' && 'd' in value) { // heuristic if Decimal shape differs
      try { return value.toNumber(); } catch { /* ignore */ }
    }
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(v => sanitizePlain(v));
    // Generic plain object – iterate keys
    const out = {};
    for (const k of Object.keys(value)) {
      const v = value[k];
      out[k] = (v && typeof v === 'object' && typeof v.toNumber === 'function' && !Array.isArray(v))
        ? safeToNumber(v)
        : sanitizePlain(v);
    }
    return out;
  }
  return value;
}

function safeToNumber(dec) {
  try { return dec.toNumber(); } catch { return dec; }
}

export function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => sanitizePlain(item));
}
