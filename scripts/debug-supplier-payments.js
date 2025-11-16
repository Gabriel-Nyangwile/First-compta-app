#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

const ids = process.argv.slice(2);

if (!ids.length) {
  console.error("Usage: node scripts/debug-supplier-payments.js <moneyMovementId> [...]");
  process.exit(1);
}

const decimalToNumber = (value) => value?.toNumber?.() ?? Number(value ?? 0);

(async () => {
  try {
    const rows = await prisma.moneyMovement.findMany({
      where: { id: { in: ids } },
      include: {
        supplier: { select: { id: true, name: true } },
        incomingInvoice: {
          select: {
            id: true,
            entryNumber: true,
            supplierInvoiceNumber: true,
            supplierId: true,
            totalAmount: true,
            paidAmount: true,
            outstandingAmount: true,
            status: true,
          },
        },
      },
    });

    if (!rows.length) {
      console.log("Aucun mouvement trouvé");
      process.exit(0);
    }

    for (const mv of rows) {
      console.log("=== Movement", mv.id, "===");
      console.log("Date:", mv.date);
      console.log("Description:", mv.description);
      console.log("Amount:", decimalToNumber(mv.amount));
      console.log("Supplier:", mv.supplier ? `${mv.supplier.name} (${mv.supplier.id})` : "(null)");
      console.log("Incoming invoice:", mv.incomingInvoice ? `${mv.incomingInvoice.entryNumber || mv.incomingInvoice.supplierInvoiceNumber || mv.incomingInvoice.id}` : "(null)");
      if (mv.incomingInvoice) {
        console.log("  Invoice supplierId:", mv.incomingInvoice.supplierId);
        console.log("  Total:", decimalToNumber(mv.incomingInvoice.totalAmount));
        console.log("  Paid:", decimalToNumber(mv.incomingInvoice.paidAmount));
        console.log("  Outstanding:", decimalToNumber(mv.incomingInvoice.outstandingAmount));
        console.log("  Status:", mv.incomingInvoice.status);
      }
      console.log();
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
