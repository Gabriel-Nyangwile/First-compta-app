#!/usr/bin/env node
/**
 * Audit script: checks supplier payment consistency.
 * - Ensures all SUPPLIER_PAYMENT movements are linked to a supplier.
 * - Compares summed payments with summed paid amounts of supplier incoming invoices.
 * - Flags negative outstanding balances.
 *
 * Usage: node scripts/audit-supplier-payments.js [--verbose] [--no-exit-error]
 */
import prisma from "../src/lib/prisma.js";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("--details");
const noExitError = args.includes("--no-exit-error");

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const decimalToNumber = (value) => value?.toNumber?.() ?? Number(value ?? 0);

(async () => {
  const issues = [];
  try {
    const [suppliers, invoiceAgg, movementAgg, orphanMovements] = await Promise.all([
      prisma.supplier.findMany({ select: { id: true, name: true } }),
      prisma.incomingInvoice.groupBy({
        by: ["supplierId"],
        _sum: {
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
        },
        _count: { _all: true },
      }),
      prisma.moneyMovement.groupBy({
        by: ["supplierId"],
        where: { kind: "SUPPLIER_PAYMENT", direction: "OUT" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.moneyMovement.findMany({
        where: { kind: "SUPPLIER_PAYMENT", direction: "OUT", supplierId: null },
        select: { id: true, date: true, amount: true, voucherRef: true, description: true },
        orderBy: { date: "desc" },
      }),
    ]);

    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    const invoiceMap = new Map(invoiceAgg.map((row) => [row.supplierId, row]));
    const movementMap = new Map(movementAgg.map((row) => [row.supplierId, row]));

    const supplierIds = new Set([
      ...invoiceAgg.map((row) => row.supplierId),
      ...movementAgg.map((row) => row.supplierId),
    ]);

    for (const supplierId of supplierIds) {
      const supplierName = supplierId ? supplierMap.get(supplierId) || "(Fournisseur inconnu)" : "(Sans fournisseur)";
      const invoicesRow = invoiceMap.get(supplierId);
      const movementsRow = movementMap.get(supplierId);

      const paidInvoices = invoicesRow ? decimalToNumber(invoicesRow._sum.paidAmount) : 0;
      const outstanding = invoicesRow ? decimalToNumber(invoicesRow._sum.outstandingAmount) : 0;
      const total = invoicesRow ? decimalToNumber(invoicesRow._sum.totalAmount) : 0;
      const invoiceCount = invoicesRow ? invoicesRow._count._all : 0;

      const movementAmount = movementsRow ? decimalToNumber(movementsRow._sum.amount) : 0;
      const movementCount = movementsRow ? movementsRow._count._all : 0;

      if (Math.abs(movementAmount - paidInvoices) > 0.01) {
        issues.push({
          type: "PAYMENT_TOTAL_MISMATCH",
          supplierId,
          supplierName,
          details: {
            payments: movementAmount,
            invoicesPaid: paidInvoices,
            delta: movementAmount - paidInvoices,
            movementCount,
            invoiceCount,
          },
        });
      }

      if (outstanding < -0.01) {
        issues.push({
          type: "NEGATIVE_OUTSTANDING",
          supplierId,
          supplierName,
          details: {
            outstanding,
            total,
            invoiceCount,
          },
        });
      }

      if (movementCount > 0 && invoiceCount === 0) {
        issues.push({
          type: "PAYMENTS_WITHOUT_INVOICES",
          supplierId,
          supplierName,
          details: {
            payments: movementAmount,
            movementCount,
          },
        });
      }
    }

    for (const orphan of orphanMovements) {
      issues.push({
        type: "ORPHAN_PAYMENT",
        supplierId: null,
        supplierName: "(Aucun)",
        details: {
          moneyMovementId: orphan.id,
          amount: decimalToNumber(orphan.amount),
          date: orphan.date?.toISOString?.() ?? null,
          voucherRef: orphan.voucherRef,
          description: orphan.description,
        },
      });
    }

    if (!issues.length) {
      console.log("Audit OK: cohérence des paiements fournisseurs confirmée.");
      if (verbose) {
        for (const supplierId of supplierIds) {
          const supplierName = supplierId ? supplierMap.get(supplierId) || "(Fournisseur inconnu)" : "(Sans fournisseur)";
          const invoicesRow = invoiceMap.get(supplierId);
          const movementsRow = movementMap.get(supplierId);
          const paidInvoices = invoicesRow ? decimalToNumber(invoicesRow._sum.paidAmount) : 0;
          const outstanding = invoicesRow ? decimalToNumber(invoicesRow._sum.outstandingAmount) : 0;
          const total = invoicesRow ? decimalToNumber(invoicesRow._sum.totalAmount) : 0;
          const invoiceCount = invoicesRow ? invoicesRow._count._all : 0;
          const movementAmount = movementsRow ? decimalToNumber(movementsRow._sum.amount) : 0;
          const movementCount = movementsRow ? movementsRow._count._all : 0;
          console.log(`${supplierName}: factures=${invoiceCount} total=${euro.format(total)} payé=${euro.format(paidInvoices)} encours=${euro.format(outstanding)} paiements=${movementCount} montant=${euro.format(movementAmount)}`);
        }
      }
      process.exit(0);
    }

    console.log(`Audit supplier payments: ${issues.length} anomalie(s) détectée(s).`);
    for (const issue of issues) {
      const { supplierName, details, type } = issue;
      switch (type) {
        case "PAYMENT_TOTAL_MISMATCH":
          console.log(`- ${supplierName}: écart paiements vs factures (${euro.format(details.payments)} vs ${euro.format(details.invoicesPaid)} | delta ${euro.format(details.delta)})`);
          break;
        case "NEGATIVE_OUTSTANDING":
          console.log(`- ${supplierName}: encours négatif ${euro.format(details.outstanding)} sur ${details.invoiceCount} facture(s)`);
          break;
        case "PAYMENTS_WITHOUT_INVOICES":
          console.log(`- ${supplierName}: ${details.movementCount} paiement(s) enregistré(s) mais aucune facture fournisseur`);
          break;
        case "ORPHAN_PAYMENT":
          console.log(`- Mouvement ${details.moneyMovementId}: paiement fournisseur sans lien (montant ${euro.format(details.amount)})`);
          break;
        default:
          console.log(`- ${supplierName}: ${type}`);
      }
      if (verbose) {
        console.log(`  Détails: ${JSON.stringify(details)}`);
      }
    }
    if (!noExitError) process.exit(1);
  } catch (error) {
    console.error("Audit échoué", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
