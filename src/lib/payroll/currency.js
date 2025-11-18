// Payroll currency helpers: enforce EUR<->CDF conversion with rounding

const DEFAULT_CDF_PER_EUR = 3000; // fallback; override via env

export function getCdfPerEur() {
  const v = Number(process.env.CDF_PER_EUR || process.env.NEXT_PUBLIC_CDF_PER_EUR);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_CDF_PER_EUR;
}

export function eurToCdf(amountEur) {
  const rate = getCdfPerEur();
  const x = toNumber(amountEur) * rate;
  return roundCdf(x);
}

export function cdfToEur(amountCdf) {
  const rate = getCdfPerEur();
  const x = toNumber(amountCdf) / rate;
  return roundEur(x);
}

export function percentOfCdf(baseCdf, pct) {
  return roundCdf(toNumber(baseCdf) * toNumber(pct) / 100);
}

export function capCdf(valueCdf, capCdf) {
  return roundCdf(Math.min(toNumber(valueCdf), toNumber(capCdf)));
}

export function toNumber(v) {
  return v?.toNumber?.() ?? (typeof v === 'string' ? Number(v) : (Number.isFinite(v) ? v : 0));
}

export function roundCdf(v) {
  // Monetary rounding in CDF (no cents)
  return Math.round(toNumber(v));
}

export function roundEur(v) {
  // Monetary rounding in EUR to 2 decimals
  return Math.round(toNumber(v) * 100) / 100;
}
