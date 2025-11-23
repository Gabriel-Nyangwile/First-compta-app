import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eurToCdf, cdfToEur, percentOfCdf, capCdf, toNumber, roundEur, roundCdf } from './currency.js';

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

export function eurCdfEur(baseEur, computeCdf) {
  const baseCdf = eurToCdf(baseEur);
  const resultCdf = computeCdf(baseCdf);
  return cdfToEur(resultCdf);
}

export function computeCnssQpoFromGrossEur(grossEur) {
  const P = getPayrollParams();
  const plafond = toNumber(P?.SOCIAL?.CNSS?.plafond_mensuel_cdf) || 0;
  const taux = (P?.SOCIAL?.CNSS?.cotisations || []).find(c => c.cle === 'CNSS_QPO')?.taux_pourcentage || 0;
  return eurCdfEur(grossEur, (grossCdf) => {
    const baseCdf = capCdf(grossCdf, plafond);
    return percentOfCdf(baseCdf, taux);
  });
}

export function computeIprBaseFromGrossEur(grossEur, cnssQpoEur) {
  const P = getPayrollParams();
  const fraisPct = toNumber(P?.FISCAL?.IPR?.frais_professionnels_forfaitaire) * 100 || 25;
  // EUR -> CDF, appliquer la formule en CDF, puis reconvertir EUR
  return eurCdfEur(grossEur, (grossCdf) => {
    const cnssQpoCdf = eurToCdf(cnssQpoEur);
    const frais = percentOfCdf(grossCdf, fraisPct);
    const base = toNumber(grossCdf) - toNumber(cnssQpoCdf) - toNumber(frais);
    return Math.max(0, base);
  });
}

export function computeAllocFamEur(nbEnfants) {
  const P = getPayrollParams();
  const unit = toNumber(P?.SOCIAL?.ALLOCATIONS_FAMILIALES?.montant_unitaire_cdf) || 0;
  const maxKids = toNumber(P?.SOCIAL?.ALLOCATIONS_FAMILIALES?.max_enfants) || 0;
  const children = Math.max(0, Math.min(maxKids, toNumber(nbEnfants)));
  const totalCdf = unit * children;
  return roundEur(cdfToEur(totalCdf));
}

export function computeIprTaxFromGrossEur(grossEur, opts = {}) {
  const { cnssQpoEur } = opts;
  const P = getPayrollParams();
  const ipr = P?.FISCAL?.IPR || {};
  const bareme = Array.isArray(ipr?.bareme) ? ipr.bareme : [];
  const capPct = toNumber(ipr?.plafond_final_pourcentage) || 0;
  const minMonthlyCdf = toNumber(ipr?.impot_minimum_mensuel_cdf) || 0;

  const qpo = toNumber(cnssQpoEur ?? computeCnssQpoFromGrossEur(grossEur));
  const baseEur = computeIprBaseFromGrossEur(grossEur, qpo);

  return eurCdfEur(baseEur, (baseMonthlyCdf) => {
    const baseMonthly = toNumber(baseMonthlyCdf);
    if (baseMonthly <= 0) return 0;

    const baseAnnual = baseMonthly * 12;

    let remaining = baseAnnual;
    let previousMax = 0;
    let taxAnnual = 0;

    for (const bracket of bareme) {
      const min = toNumber(bracket.revenu_min_annuel) || (previousMax + 1);
      const max = toNumber(bracket.revenu_max_annuel) || Infinity;
      const rate = toNumber(bracket.taux) || 0;

      const lower = Math.max(previousMax, min - 0); // inclusive min
      const upper = max; // inclusive upper in data, treat as cap

      if (baseAnnual <= lower) {
        break;
      }

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
  });
}
