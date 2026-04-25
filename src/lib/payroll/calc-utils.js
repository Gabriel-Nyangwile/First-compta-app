import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  percentOfCdf,
  capCdf,
  toNumber,
  roundCdf,
  fromFiscalCurrency,
  normalizeCurrency,
  roundProcessingCurrency,
  toFiscalCurrency,
} from './currency.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const paramsPath = path.resolve(__dirname, '../../data/payroll/rdc-params.json');
let cachedParams = null;
function loadParams() {
  if (!cachedParams) {
    const raw = fs.readFileSync(paramsPath, 'utf8');
    cachedParams = JSON.parse(raw);
  }
  return cachedParams;
}

export function getPayrollParams() {
  const p = loadParams();
  return p?.PARAMETRES_PAIE_GLOBAL || {};
}

export function processingCdfProcessing(baseAmount, computeCdf, options = {}) {
  const processingCurrency = normalizeCurrency(options.processingCurrency, 'EUR');
  const rateToCdf = options.fxRate ?? null;
  const baseCdf = toFiscalCurrency(baseAmount, processingCurrency, rateToCdf);
  const resultCdf = computeCdf(baseCdf);
  return fromFiscalCurrency(resultCdf, processingCurrency, rateToCdf);
}

export function eurCdfEur(baseEur, computeCdf) {
  return processingCdfProcessing(baseEur, computeCdf, { processingCurrency: 'EUR' });
}

export function computeCnssQpoFromGross(grossAmount, options = {}) {
  const processingCurrency = normalizeCurrency(options.processingCurrency, 'EUR');
  const rateToCdf = options.fxRate ?? null;
  const P = getPayrollParams();
  const plafond = toNumber(P?.SOCIAL?.CNSS?.plafond_mensuel_cdf) || 0;
  const taux = (P?.SOCIAL?.CNSS?.cotisations || []).find(c => c.cle === 'CNSS_QPO')?.taux_pourcentage || 0;
  return processingCdfProcessing(grossAmount, (grossCdf) => {
    const baseCdf = capCdf(grossCdf, plafond);
    return percentOfCdf(baseCdf, taux);
  }, { processingCurrency, fxRate: rateToCdf });
}

export function computeCnssQpoFromGrossEur(grossEur) {
  return computeCnssQpoFromGross(grossEur, { processingCurrency: 'EUR' });
}

export function computeIprBaseFromGross(grossAmount, cnssQpoAmount, options = {}) {
  const processingCurrency = normalizeCurrency(options.processingCurrency, 'EUR');
  const rateToCdf = options.fxRate ?? null;
  const P = getPayrollParams();
  const fraisPct = toNumber(P?.FISCAL?.IPR?.frais_professionnels_forfaitaire) * 100 || 25;
  return processingCdfProcessing(grossAmount, (grossCdf) => {
    const cnssQpoCdf = toFiscalCurrency(cnssQpoAmount, processingCurrency, rateToCdf);
    const frais = percentOfCdf(grossCdf, fraisPct);
    const base = toNumber(grossCdf) - toNumber(cnssQpoCdf) - toNumber(frais);
    return Math.max(0, base);
  }, { processingCurrency, fxRate: rateToCdf });
}

export function computeIprBaseFromGrossEur(grossEur, cnssQpoEur) {
  return computeIprBaseFromGross(grossEur, cnssQpoEur, { processingCurrency: 'EUR' });
}

export function computeAllocFam(nbEnfants, options = {}) {
  const processingCurrency = normalizeCurrency(options.processingCurrency, 'EUR');
  const rateToCdf = options.fxRate ?? null;
  const P = getPayrollParams();
  const unit = toNumber(P?.SOCIAL?.ALLOCATIONS_FAMILIALES?.montant_unitaire_cdf) || 0;
  const maxKids = toNumber(P?.SOCIAL?.ALLOCATIONS_FAMILIALES?.max_enfants) || 0;
  const children = Math.max(0, Math.min(maxKids, toNumber(nbEnfants)));
  const totalCdf = unit * children;
  return roundProcessingCurrency(fromFiscalCurrency(totalCdf, processingCurrency, rateToCdf), processingCurrency);
}

export function computeAllocFamEur(nbEnfants) {
  return computeAllocFam(nbEnfants, { processingCurrency: 'EUR' });
}

export function computeIprTaxFromGross(grossAmount, opts = {}) {
  const processingCurrency = normalizeCurrency(opts.processingCurrency, 'EUR');
  const rateToCdf = opts.fxRate ?? null;
  const { cnssQpoAmount } = opts;
  const P = getPayrollParams();
  const ipr = P?.FISCAL?.IPR || {};
  const bareme = Array.isArray(ipr?.bareme) ? ipr.bareme : [];
  const capPct = toNumber(ipr?.plafond_final_pourcentage) || 0;
  const minMonthlyCdf = toNumber(ipr?.impot_minimum_mensuel_cdf) || 0;

  const qpo = toNumber(cnssQpoAmount ?? computeCnssQpoFromGross(grossAmount, { processingCurrency, fxRate: rateToCdf }));
  const baseAmount = computeIprBaseFromGross(grossAmount, qpo, { processingCurrency, fxRate: rateToCdf });

  return processingCdfProcessing(baseAmount, (baseMonthlyCdf) => {
    const baseMonthly = toNumber(baseMonthlyCdf);
    if (baseMonthly <= 0) return 0;

    const baseAnnual = baseMonthly * 12;

    let previousMax = 0;
    let taxAnnual = 0;

    for (const bracket of bareme) {
      const min = toNumber(bracket.revenu_min_annuel) || previousMax;
      const max = toNumber(bracket.revenu_max_annuel) || Infinity;
      const rate = toNumber(bracket.taux) || 0;

      const lower = Math.max(previousMax, min);
      const upper = max;

      if (baseAnnual <= lower) break;

      const taxableInBracket = Math.max(0, Math.min(baseAnnual, upper) - lower);
      if (taxableInBracket > 0 && rate > 0) {
        taxAnnual += (taxableInBracket * rate) / 100;
      }

      previousMax = Math.max(previousMax, upper);
      if (baseAnnual <= upper) break;
    }

    let taxMonthlyCdf = roundCdf(taxAnnual / 12);

    if (capPct > 0) {
      const cap = roundCdf((baseMonthly * capPct) / 100);
      taxMonthlyCdf = Math.min(taxMonthlyCdf, cap);
    }

    if (minMonthlyCdf > 0) {
      taxMonthlyCdf = Math.max(taxMonthlyCdf, minMonthlyCdf);
    }

    return taxMonthlyCdf;
  }, { processingCurrency, fxRate: rateToCdf });
}

export function computeIprTaxFromGrossEur(grossEur, opts = {}) {
  return computeIprTaxFromGross(grossEur, {
    processingCurrency: 'EUR',
    cnssQpoAmount: opts.cnssQpoEur,
  });
}
