#!/usr/bin/env node
// Validate RDC payroll config JSONs against the plan comptable and basic rules
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const root = path.resolve(process.cwd());
const dataDir = path.join(root, 'src', 'data');

const planFile = path.join(dataDir, 'plan-comptable.csv');
const accountsFile = path.join(dataDir, 'rdc-payroll-accounts.json');
const taxFile = path.join(dataDir, 'rdc-taxrule-ipr.json');
const schemesFile = path.join(dataDir, 'rdc-contribution-schemes.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function readPlanCsv(p) {
  return new Promise((resolve, reject) => {
    const map = new Map();
    fs.createReadStream(p)
      .pipe(csv({ separator: ';' }))
      .on('data', (row) => {
        const numero = String(row['numero']).trim();
        const libelle = String(row['libelle'] || '').trim();
        if (numero) map.set(numero, libelle);
      })
      .on('end', () => resolve(map))
      .on('error', reject);
  });
}

function ok(msg) { console.log(`✔ ${msg}`); }
function warn(msg) { console.warn(`! ${msg}`); }
function fail(msg) { console.error(`✖ ${msg}`); }

async function main() {
  let exit = 0;
  if (!fs.existsSync(planFile)) { fail(`Missing ${planFile}`); process.exit(2); }
  if (!fs.existsSync(accountsFile)) { fail(`Missing ${accountsFile}`); process.exit(2); }
  if (!fs.existsSync(taxFile)) { fail(`Missing ${taxFile}`); process.exit(2); }
  if (!fs.existsSync(schemesFile)) { fail(`Missing ${schemesFile}`); process.exit(2); }

  const plan = await readPlanCsv(planFile);
  const accounts = readJson(accountsFile);
  const tax = readJson(taxFile);
  const schemes = readJson(schemesFile);

  // Validate account numbers exist in plan comptable
  const needed = Object.values(accounts.accounts).map(a => a.number);
  for (const num of needed) {
    if (!plan.has(num)) { warn(`Account ${num} not found in plan-comptable.csv (ok si plan entreprise étendu)`); }
    else ok(`Account ${num} • ${plan.get(num)}`);
  }

  // Treasury prefixes
  if (accounts.treasury?.BANK_PREFIX !== '521') { fail('BANK_PREFIX must be 521 (RDC requirement)'); exit = 1; }
  else ok('BANK_PREFIX 521 confirmed');
  if (accounts.treasury?.CASH_PREFIX !== '57') { fail('CASH_PREFIX must be 57'); exit = 1; }
  else ok('CASH_PREFIX 57 confirmed');

  // Tax rule sanity
  if (!Array.isArray(tax['barème_impot_annuel']) || tax['barème_impot_annuel'].length < 1) {
    fail('Tax rule barème_impot_annuel is missing'); exit = 1;
  } else {
    ok(`Tax rule ${tax.code} • ${tax['barème_impot_annuel'].length} tranches`);
  }
  const minRule = tax['regles_limitation_et_minimum'];
  if (!minRule || typeof minRule['plafonnement_impot_pourcentage_max'] !== 'number') {
    fail('Tax min/limit rules missing or invalid'); exit = 1;
  } else {
    ok(`Tax limit max ${minRule['plafonnement_impot_pourcentage_max']}% and minimum ${minRule['impot_minimum_apres_charges_cdf']} CDF`);
  }

  // Contribution schemes sanity
  const cnss = schemes.schemes.find(s => s.code === 'CNSS');
  if (!cnss || cnss.employeeRate !== 0.05 || cnss.employerRate !== 0.05) {
    fail('CNSS rates must be 5% employee and 5% employer'); exit = 1;
  } else {
    ok('CNSS 5% employee + 5% employer confirmed');
  }
  const onem = schemes.schemes.find(s => s.code === 'ONEM');
  if (!onem || onem.employerRate !== 0.005) { fail('ONEM employer 0.5% missing'); exit = 1; } else { ok('ONEM 0.5% employer confirmed'); }
  const inpp = schemes.schemes.find(s => s.code.startsWith('INPP'));
  if (!inpp) { warn('INPP scheme not found – add if required'); } else { ok(`INPP scheme ${inpp.code} at ${inpp.employerRate * 100}%`); }

  ok('RDC payroll config validation completed');
  process.exit(exit);
}

main().catch((e) => { console.error(e); process.exit(2); });
