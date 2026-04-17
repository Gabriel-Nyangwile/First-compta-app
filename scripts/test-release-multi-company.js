#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = argv.slice(2);
  const companyIndex = args.indexOf("--companyId");
  return {
    companyId: companyIndex >= 0 ? args[companyIndex + 1] : null,
  };
}

function runStep(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      code: result.status ?? 1,
      label,
    };
  }
  return { ok: true, code: 0, label };
}

function nodeArgs(script, companyId = null) {
  const args = ["--env-file=.env.local", script];
  if (companyId) {
    args.push("--companyId", companyId);
  }
  return args;
}

async function main() {
  const { companyId } = parseArgs(process.argv);
  const scopeLabel = companyId ? `companyId=${companyId}` : "ALL";

  console.log("=== Multi-Company Release Gate ===");
  console.log(`Scope: ${scopeLabel}`);

  const steps = [
    ["Prisma Connectivity", "node", nodeArgs("scripts/verify-prisma.js")],
    ["Multi-Company Isolation", "node", nodeArgs("scripts/test-multi-company-isolation.js")],
    ["Multi-Company Runtime", "node", nodeArgs("scripts/test-multi-company-runtime.js")],
    ["Multi-Company Onboarding", "node", nodeArgs("scripts/test-multi-company-onboarding-flow.js")],
    ["Journal Integrity", "node", nodeArgs("scripts/test-journal-integrity.js", companyId)],
    ["Ledger Balance", "node", [...nodeArgs("scripts/ledger-balance.js", companyId)]],
    ["Multi-Company Audit", "node", [...nodeArgs("scripts/audit-multi-company.js", companyId)]],
  ];

  for (const [label, command, args] of steps) {
    const result = runStep(label, command, args);
    if (!result.ok) {
      if (label === "Journal Integrity") {
        console.error(
          "\nRelease gate bloquée: l'intégrité journal n'est pas propre sur ce périmètre."
        );
        console.error(
          "Cause probable ici: journaux historiques vides déjà identifiés pendant le Lot 2."
        );
        if (!companyId) {
          console.error(
            "Utilisez éventuellement --companyId pour valider une société cible sans reprendre tout l'historique global."
          );
        }
      }
      process.exit(result.code);
    }
  }

  console.log("\nRelease gate OK.");
}

main().catch((error) => {
  console.error("test-release-multi-company fatal:", error);
  process.exit(1);
});
