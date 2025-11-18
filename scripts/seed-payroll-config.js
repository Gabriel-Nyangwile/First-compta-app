#!/usr/bin/env node
// Seed RDC payroll configuration into Prisma tables from JSON files
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

const root = path.resolve(process.cwd());
const dataDir = path.join(root, 'src', 'data');

const accountsFile = path.join(dataDir, 'rdc-payroll-accounts.json');
// Unified payroll params (includes IPR section)
const payrollParamsFile = path.join(dataDir, 'payroll', 'rdc-params.json');
const schemesFile = path.join(dataDir, 'rdc-contribution-schemes.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function toContributionBaseKind(s) {
  const k = String(s || '').toUpperCase();
  if (k === 'BRUT') return 'BRUT';
  if (k === 'RI' || k === 'IMPOSABLE') return 'IMPOSABLE';
  if (k === 'BASE' || k === 'BASE_SALAIRE') return 'BASE_SALAIRE';
  return 'BRUT';
}

async function upsertPayrollAccountMapping(accountsJson) {
  const entries = accountsJson.accounts || {};
  for (const [code, obj] of Object.entries(entries)) {
    await prisma.payrollAccountMapping.upsert({
      where: { code },
      update: {
        accountNumber: obj.number,
        label: obj.label,
        active: true,
      },
      create: {
        code,
        accountNumber: obj.number,
        label: obj.label,
        active: true,
      },
    });
    console.log(`↑ Mapping ${code} -> ${obj.number} (${obj.label})`);
  }
}

async function upsertTaxRuleFromParams(paramsJson) {
  const ipr = paramsJson?.PARAMETRES_PAIE_GLOBAL?.FISCAL?.IPR;
  if (!ipr) {
    console.warn('No IPR section found in unified payroll params');
    return;
  }
  // Synthesize legacy shape
  const bracketsSrc = ipr.bareme || [];
  const taxJson = {
    code: 'IPR_RDC_2025',
    label: 'IPR RDC (barème annuel en CDF)',
    currency: 'CDF',
    source: 'unified:payroll/rdc-params.json',
    'barème_impot_annuel': bracketsSrc.map(b => {
      if (b.revenu_max_annuel != null) {
        return {
          revenu_maximum_annuel_cdf: b.revenu_max_annuel,
          taux_impot_progressif_pourcentage: b.taux
        };
      }
      if (b.revenu_min_annuel != null) {
        return {
          revenu_minimum_annuel_cdf: b.revenu_min_annuel,
          taux_impot_progressif_pourcentage: b.taux
        };
      }
      return {};
    }),
    'regles_limitation_et_minimum': {
      plafonnement_impot_pourcentage_max: ipr.plafond_final_pourcentage,
      impot_minimum_apres_charges_cdf: ipr.impot_minimum_mensuel_cdf,
      note_impot_minimum: 'Valeur mensuelle minimum (unifiée)'
    }
  };

  // Reuse existing logic below
  // Transform the provided French JSON into generic brackets
  const bracketsLegacy = taxJson['barème_impot_annuel'] || taxJson['bareme_impot_annuel'] || [];
  const brackets = [];
  for (const b of bracketsLegacy) {
    if (b.revenu_maximum_annuel_cdf != null) {
      brackets.push({ max: b.revenu_maximum_annuel_cdf, rate: b.taux_impot_progressif_pourcentage / 100 });
    } else if (b.revenu_minimum_annuel_cdf != null) {
      // last open bracket
      brackets.push({ max: null, rate: b.taux_impot_progressif_pourcentage / 100 });
    }
  }
  const meta = {
    currency: taxJson.currency || 'CDF',
    minRule: taxJson['regles_limitation_et_minimum'] || {},
    source: taxJson.source || null,
    unified: true
  };
  const code = taxJson.code || 'IPR_RDC_2025';
  const label = taxJson.label || 'IPR RDC (barème annuel en CDF)';
  await prisma.taxRule.upsert({
    where: { code },
    update: { label, brackets, roundingMode: 'BANKERS', active: true, meta },
    create: { code, label, brackets, roundingMode: 'BANKERS', active: true, meta },
  });
  console.log(`↑ TaxRule ${code} upserted (${brackets.length} tranches)`);
}

async function upsertContributionSchemes(schemesJson) {
  const list = schemesJson.schemes || [];
  for (const s of list) {
    const code = s.code;
    await prisma.contributionScheme.upsert({
      where: { code },
      update: {
        label: s.label,
        employeeRate: s.employeeRate,
        employerRate: (s.employerRate ?? 0) + (s.employerRiskRate ?? 0),
        ceiling: s.ceilingCDF ?? null,
        baseKind: toContributionBaseKind(s.base),
        active: true,
        meta: s,
      },
      create: {
        code,
        label: s.label,
        employeeRate: s.employeeRate,
        employerRate: (s.employerRate ?? 0) + (s.employerRiskRate ?? 0),
        ceiling: s.ceilingCDF ?? null,
        baseKind: toContributionBaseKind(s.base),
        active: true,
        meta: s,
      },
    });
    console.log(`↑ ContributionScheme ${code} (${s.label})`);
  }
}

async function main() {
  if (!fs.existsSync(accountsFile) || !fs.existsSync(payrollParamsFile) || !fs.existsSync(schemesFile)) {
    console.error('Missing one or more config files in src/data');
    process.exit(2);
  }
  const accounts = readJson(accountsFile);
  const payrollParams = readJson(payrollParamsFile);
  const schemes = readJson(schemesFile);

  await upsertPayrollAccountMapping(accounts);
  await upsertTaxRuleFromParams(payrollParams);
  await upsertContributionSchemes(schemes);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
