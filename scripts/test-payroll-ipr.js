#!/usr/bin/env node
import { getCdfPerEur } from '../src/lib/payroll/currency.js';
import {
  computeCnssQpoFromGrossEur,
  computeIprBaseFromGrossEur,
  computeIprTaxFromGrossEur,
  getPayrollParams,
} from '../src/lib/payroll/calc-utils.js';

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(2) : String(n);
}

async function main() {
  const rate = getCdfPerEur();
  console.log(`[env] CDF_PER_EUR = ${rate}`);
  const P = getPayrollParams();
  const minCDF = P?.FISCAL?.IPR?.impot_minimum_mensuel_cdf;
  const capPct = P?.FISCAL?.IPR?.plafond_final_pourcentage;
  console.log(`[IPR] min monthly CDF = ${minCDF}, cap = ${capPct}%`);

  const samples = [300, 500, 800, 1000, 2000]; // gross EUR examples
  for (const gross of samples) {
    const cnss = computeCnssQpoFromGrossEur(gross);
    const base = computeIprBaseFromGrossEur(gross, cnss);
    const ipr = computeIprTaxFromGrossEur(gross, { cnssQpoEur: cnss });
    console.log(`Gross EUR ${fmt(gross)} -> CNSS(QPO) EUR ${fmt(cnss)} | IPR base EUR ${fmt(base)} | IPR tax EUR ${fmt(ipr)}`);
  }

  // sanity: round-trip effect at a single point
  const gross = 1000;
  const cnss = computeCnssQpoFromGrossEur(gross);
  const base = computeIprBaseFromGrossEur(gross, cnss);
  const ipr = computeIprTaxFromGrossEur(gross, { cnssQpoEur: cnss });
  console.log(`[sanity] gross=${fmt(gross)} cnss=${fmt(cnss)} base=${fmt(base)} ipr=${fmt(ipr)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
