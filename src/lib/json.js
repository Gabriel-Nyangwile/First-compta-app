// Simple deep serializer to make Prisma Decimal JSON-safe
export function toPlain(value) {
  if (value && typeof value === 'object') {
    // Prisma Decimal has toNumber()
    if (typeof value.toNumber === 'function') {
      try {
        return value.toNumber();
      } catch {}
    }
    if (Array.isArray(value)) return value.map(toPlain);
    const out = {};
    for (const k in value) {
      out[k] = toPlain(value[k]);
    }
    return out;
  }
  return value;
}
