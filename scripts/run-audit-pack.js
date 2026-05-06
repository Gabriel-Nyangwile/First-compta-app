#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const packs = {
  quick: [
    ["test:smoke", "Sante application et regressions structurelles rapides"],
    ["ledger:balance", "Equilibre global debit/credit"],
  ],
  accounting: [
    ["test:smoke", "Sante application"],
    ["test:ledger-lettering", "Grand livre et lettrage"],
    ["test:lettering-flow", "Flux client/fournisseur lettrables"],
    ["ledger:balance", "Equilibre global debit/credit"],
    ["audit:invoice-balances", "Soldes factures clients/fournisseurs"],
    ["audit:party-ids", "Rattachement tiers sur transactions"],
    ["check:vat", "TVA comptabilisee"],
    ["test:regression", "Liens lignes/factures"],
  ],
  payroll: [
    ["audit:payroll-config", "Configuration paie RDC"],
    ["test:payroll:currency", "Pipeline devises paie"],
    ["test:payroll:ipr", "Calcul IPR"],
    ["test:payroll:post", "Posting paie"],
    ["audit:payroll:posting", "Audit posting paie"],
    ["smoke:payroll:fully-settled", "Periode totalement reglee"],
    ["smoke:payroll:lettering", "Lettrage passifs paie"],
  ],
  treasury: [
    ["test:money-movement", "Mouvements de tresorerie"],
    ["test:treasury:recipe", "Recette tresorerie"],
    ["audit:supplier-payments", "Paiements fournisseurs"],
    ["audit:authorization:movements", "Mouvements autorisations"],
    ["audit:mission-advance-regularizations", "Regularisations avances mission"],
    ["audit:open-mission-advances", "Avances mission ouvertes"],
    ["audit:treasury:employee-movements", "Mouvements employes"],
  ],
  stock: [
    ["test:inventory-flow", "Flux inventaire et CUMP"],
    ["audit:stock", "Cohérence stock"],
    ["audit:stock-withdrawals", "Sorties stock"],
    ["test:production-flow", "Flux production stockee"],
    ["test:http:inventory", "Endpoints inventaire"],
    ["test:po-flow", "Flux achat"],
    ["test:po-cancel", "Annulation achat"],
    ["test:return-order", "Retours"],
  ],
  production: [
    ["test:production-flow", "Nomenclature, ordre, consommation, entree produit fini et cloture"],
  ],
  "multi-company": [
    ["test:multi-company:all", "Isolation, runtime et onboarding multi-societe"],
  ],
  opening: [
    ["test:opening", "Imports d'ouverture complets"],
    ["test:closing", "Cloture annuelle et a-nouveaux"],
  ],
};

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const packName = args.find((arg) => !arg.startsWith("--"));
const dryRun = has("--dry-run");
const continueOnError = has("--continue-on-error");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function printHelp() {
  console.log("Usage: node scripts/run-audit-pack.js <pack> [--dry-run] [--continue-on-error]");
  console.log("       node scripts/run-audit-pack.js --list");
  console.log("");
  console.log("Packs disponibles:");
  for (const [name, steps] of Object.entries(packs)) {
    console.log(`- ${name} (${steps.length} commande${steps.length > 1 ? "s" : ""})`);
  }
}

function printList() {
  for (const [name, steps] of Object.entries(packs)) {
    console.log(`\n${name}`);
    for (const [script, description] of steps) {
      console.log(`  npm run ${script} - ${description}`);
    }
  }
}

if (has("--help") || has("-h")) {
  printHelp();
  process.exit(0);
}

if (has("--list")) {
  printList();
  process.exit(0);
}

if (!packName) {
  printHelp();
  printList();
  process.exit(0);
}

const steps = packs[packName];
if (!steps) {
  console.error(`Pack inconnu: ${packName}`);
  printHelp();
  process.exit(1);
}

const results = [];
console.log(`Audit pack: ${packName}`);

for (const [script, description] of steps) {
  console.log(`\n> npm run ${script}`);
  console.log(`  ${description}`);

  if (dryRun) {
    results.push({ script, status: "DRY_RUN" });
    continue;
  }

  const startedAt = Date.now();
  const result = spawnSync(npmCmd, ["run", script], {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const status = result.status === 0 ? "OK" : "FAIL";
  results.push({ script, status, code: result.status, durationSeconds });

  if (result.error) {
    console.error(result.error.message);
  }
  if (status === "FAIL" && !continueOnError) {
    break;
  }
}

console.log("\nSynthese pack:");
for (const item of results) {
  const suffix = item.durationSeconds ? ` (${item.durationSeconds}s)` : "";
  console.log(`- ${item.status.padEnd(7)} npm run ${item.script}${suffix}`);
}

const failed = results.filter((item) => item.status === "FAIL");
if (failed.length) {
  console.error(`\n${failed.length} commande(s) en echec.`);
  process.exit(1);
}

console.log("\nPack termine sans echec.");
