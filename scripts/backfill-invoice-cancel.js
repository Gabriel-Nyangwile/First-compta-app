#!/usr/bin/env node
// Script d'annulation/refacturation de facture : décrémente les quantityInvoiced des SalesOrderLine liées
import prisma from "../src/lib/prisma.js";

async function cancelInvoice(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { invoiceLines: true },
  });
  if (!invoice) throw new Error("Facture introuvable");
  const updates = [];
  for (const line of invoice.invoiceLines) {
    if (line.salesOrderLineId && line.quantity) {
      const soLine = await prisma.salesOrderLine.findUnique({
        where: { id: line.salesOrderLineId },
      });
      if (!soLine) continue;
      const prev =
        soLine.quantityInvoiced?.toNumber?.() ??
        Number(soLine.quantityInvoiced ?? 0);
      const toDecrement =
        line.quantity?.toNumber?.() ?? Number(line.quantity ?? 0);
      const next = Math.max(0, prev - toDecrement);
      updates.push(
        prisma.salesOrderLine.update({
          where: { id: soLine.id },
          data: { quantityInvoiced: next.toFixed(3) },
        })
      );
    }
  }
  await Promise.all(updates);
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "CANCELLED" },
  });
  console.log(`Facture ${invoiceId} annulée et SO décrémenté.`);
}

if (require.main === module) {
  const invoiceId = process.argv[2];
  if (!invoiceId) {
    console.error("Usage: node backfill-invoice-cancel.js <invoiceId>");
    process.exit(1);
  }
  cancelInvoice(invoiceId).catch((err) => {
    console.error("Erreur:", err);
    process.exit(1);
  });
}
