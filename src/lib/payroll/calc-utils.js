import params from '@/data/payroll/rdc-params.json' assert { type: 'json' };
import { eurToCdf, cdfToEur, percentOfCdf, capCdf, toNumber, roundEur } from './currency.js';

export function getPayrollParams() {
  return params?.PARAMETRES_PAIE_GLOBAL || {};
}

// Pipeline helper: EUR -> CDF compute -> EUR
export function eurCdfEur(baseEur, computeCdf) {
  const baseCdf = eurToCdf(baseEur);
  const resultCdf = computeCdf(baseCdf);
  return cdfToEur(resultCdf);
}

// CNSS Salariale (QPO ouvrière) – 5% plafonnée au plafond CNSS
export function computeCnssQpoFromGrossEur(grossEur) {
  const P = getPayrollParams();
  const plafond = toNumber(P?.SOCIAL?.CNSS?.plafond_mensuel_cdf) || 0;
  const taux = (P?.SOCIAL?.CNSS?.cotisations || []).find(c => c.cle === 'CNSS_QPO')?.taux_pourcentage || 0;
  return eurCdfEur(grossEur, (grossCdf) => {
    const baseCdf = capCdf(grossCdf, plafond);
    return percentOfCdf(baseCdf, taux);
  });
}

// IPR – base imposable mensuelle selon règle fournie
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

// Allocations familiales (montant en CDF, reconverti en EUR)
export function computeAllocFamEur(nbEnfants) {
  const P = getPayrollParams();
  const unit = toNumber(P?.SOCIAL?.ALLOCATIONS_FAMILIALES?.montant_unitaire_cdf) || 0;
  const maxKids = toNumber(P?.SOCIAL?.ALLOCATIONS_FAMILIALES?.max_enfants) || 0;
  const children = Math.max(0, Math.min(maxKids, toNumber(nbEnfants)));
  const totalCdf = unit * children;
  return roundEur(cdfToEur(totalCdf));
}
