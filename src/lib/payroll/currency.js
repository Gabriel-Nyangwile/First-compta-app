// Payroll currency helpers:
// - processing currency = company default currency
// - fiscal currency = CDF
// Statutory calculations should pass through CDF, then be converted back.

const DEFAULT_FISCAL_CURRENCY = "CDF";
const DEFAULT_CDF_PER_EUR = 3000; // legacy fallback for EUR->CDF if no FX rate is provided

export function normalizeCurrency(currency, fallback = "XOF") {
  const normalized = String(currency || "").trim().toUpperCase();
  return normalized || fallback;
}

function getGenericCdfRateEnvKey(fromCurrency) {
  return `PAYROLL_FX_${normalizeCurrency(fromCurrency)}_CDF`;
}

export function getFallbackRateToCdf(fromCurrency) {
  const source = normalizeCurrency(fromCurrency, "EUR");
  if (source === DEFAULT_FISCAL_CURRENCY) return 1;
  if (source === "EUR") {
    const v = Number(process.env.CDF_PER_EUR || process.env.NEXT_PUBLIC_CDF_PER_EUR);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_CDF_PER_EUR;
  }
  const v = Number(process.env[getGenericCdfRateEnvKey(source)]);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function getCdfPerEur() {
  return getFallbackRateToCdf("EUR");
}

export function toNumber(v) {
  return v?.toNumber?.() ?? (typeof v === "string" ? Number(v) : (Number.isFinite(v) ? v : 0));
}

export function roundCurrency(v, currency = "XOF") {
  const normalized = normalizeCurrency(currency);
  const value = toNumber(v);
  if (normalized === DEFAULT_FISCAL_CURRENCY) {
    return Math.round(value);
  }
  return Math.round(value * 100) / 100;
}

export function roundCdf(v) {
  return roundCurrency(v, DEFAULT_FISCAL_CURRENCY);
}

export function roundEur(v) {
  return roundCurrency(v, "EUR");
}

export function roundProcessingCurrency(v, processingCurrency = "XOF") {
  return roundCurrency(v, processingCurrency);
}

export function convertAmount(amount, { fromCurrency, toCurrency, rateToCdf = null }) {
  const source = normalizeCurrency(fromCurrency);
  const target = normalizeCurrency(toCurrency);
  const value = toNumber(amount);
  if (source === target) return roundCurrency(value, target);

  const rate = Number.isFinite(Number(rateToCdf)) && Number(rateToCdf) > 0
    ? Number(rateToCdf)
    : getFallbackRateToCdf(source === DEFAULT_FISCAL_CURRENCY ? target : source);

  if (source !== DEFAULT_FISCAL_CURRENCY && target === DEFAULT_FISCAL_CURRENCY) {
    return roundCurrency(value * rate, target);
  }
  if (source === DEFAULT_FISCAL_CURRENCY && target !== DEFAULT_FISCAL_CURRENCY) {
    return roundCurrency(value / rate, target);
  }

  const cdfAmount = convertAmount(value, { fromCurrency: source, toCurrency: DEFAULT_FISCAL_CURRENCY, rateToCdf: rate });
  return convertAmount(cdfAmount, { fromCurrency: DEFAULT_FISCAL_CURRENCY, toCurrency: target, rateToCdf: rate });
}

export function toFiscalCurrency(amount, processingCurrency = "XOF", rateToCdf = null) {
  return convertAmount(amount, {
    fromCurrency: processingCurrency,
    toCurrency: DEFAULT_FISCAL_CURRENCY,
    rateToCdf,
  });
}

export function fromFiscalCurrency(amountCdf, processingCurrency = "XOF", rateToCdf = null) {
  return convertAmount(amountCdf, {
    fromCurrency: DEFAULT_FISCAL_CURRENCY,
    toCurrency: processingCurrency,
    rateToCdf,
  });
}

// Legacy compatibility wrappers
export function eurToCdf(amountEur) {
  return toFiscalCurrency(amountEur, "EUR");
}

export function cdfToEur(amountCdf) {
  return fromFiscalCurrency(amountCdf, "EUR");
}

export function percentOfCdf(baseCdf, pct) {
  return roundCdf(toNumber(baseCdf) * toNumber(pct) / 100);
}

export function capCdf(valueCdf, capValueCdf) {
  return roundCdf(Math.min(toNumber(valueCdf), toNumber(capValueCdf)));
}
