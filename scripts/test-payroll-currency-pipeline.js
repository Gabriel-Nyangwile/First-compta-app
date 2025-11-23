import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPayrollParams, computeCnssQpoFromGrossEur, computeIprBaseFromGrossEur, computeAllocFamEur } from '../src/lib/payroll/calc-utils.js';
import { eurToCdf, cdfToEur, getCdfPerEur } from '../src/lib/payroll/currency.js';

// Load .env.local (project root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local') });

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
