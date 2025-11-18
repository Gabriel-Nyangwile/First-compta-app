import { getPayrollParams, computeCnssQpoFromGrossEur, computeIprBaseFromGrossEur, computeAllocFamEur } from '@/lib/payroll/calc-utils.js';
import { eurToCdf, cdfToEur, getCdfPerEur } from '@/lib/payroll/currency.js';

console.log('--- Payroll EUR<->CDF pipeline smoke ---');
console.log('Rate CDF_PER_EUR =', getCdfPerEur());

const grossEur = Number(process.argv[2] || 1000); // example EUR gross
const kids = Number(process.argv[3] || 2);

const P = getPayrollParams();
console.log('Params IPR frais forfaitaire =', P?.FISCAL?.IPR?.frais_professionnels_forfaitaire);

const grossCdf = eurToCdf(grossEur);
console.log('Gross EUR->CDF:', grossEur, '->', grossCdf);

const cnssQpoEur = computeCnssQpoFromGrossEur(grossEur);
console.log('CNSS QPO (EUR):', cnssQpoEur);

const iprBaseEur = computeIprBaseFromGrossEur(grossEur, cnssQpoEur);
console.log('IPR base (EUR):', iprBaseEur);

const allocFamEur = computeAllocFamEur(kids);
console.log('Allocations familiales (EUR):', allocFamEur, `(kids=${kids})`);

console.log('Round-trip check 100 EUR -> CDF -> EUR:', cdfToEur(eurToCdf(100)));
console.log('Done.');
