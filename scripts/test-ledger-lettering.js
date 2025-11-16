#!/usr/bin/env node
/**
 * Automated test ensuring ledger lettering consistency by reusing the audit logic.
 * Fails (exit code 1) when discrepancies are detected.
 */
import prisma from "../src/lib/prisma.js";
import { auditLettering } from "./audit-ledger-lettering.js";

async function main() {
  try {
    const findings = await auditLettering({ fix: false });

    if (findings.length) {
      console.error(
        `Ledger lettering test failed with ${findings.length} issues.`
      );
      // Print at most the first few findings to keep output manageable.
      console.error(JSON.stringify(findings.slice(0, 5), null, 2));
      if (findings.length > 5) {
        console.error(
          `…and ${findings.length - 5} additional discrepancies not shown.`
        );
      }
      process.exitCode = 1;
    } else {
      console.log("Ledger lettering test passed: no discrepancies detected.");
    }
  } catch (error) {
    console.error("Ledger lettering test encountered an error", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
