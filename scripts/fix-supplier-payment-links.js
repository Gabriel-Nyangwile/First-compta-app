#!/usr/bin/env node
/**
 * Fix script: ensure supplier payments are linked to the supplier of the associated incoming invoice.
 */
import prisma from "../src/lib/prisma.js";

(async () => {
  try {
    const movements = await prisma.moneyMovement.findMany({
      where: {
        kind: "SUPPLIER_PAYMENT",
        direction: "OUT",
        supplierId: null,
        incomingInvoiceId: { not: null },
      },
      include: {
        incomingInvoice: { select: { supplierId: true, entryNumber: true } },
      },
    });

    if (!movements.length) {
      console.log("Aucun mouvement à corriger.");
      await prisma.$disconnect();
      process.exit(0);
    }

    for (const mv of movements) {
      const supplierId = mv.incomingInvoice?.supplierId;
      if (!supplierId) {
        console.warn(
          `Mouvement ${mv.id} : facture sans supplierId, aucune correction.`
        );
        continue;
      }
      await prisma.moneyMovement.update({
        where: { id: mv.id },
        data: { supplierId },
      });
      console.log(
        `Mouvement ${mv.id} relié au fournisseur ${supplierId} (facture ${
          mv.incomingInvoice.entryNumber || "?"
        }).`
      );
    }
  } catch (error) {
    console.error("Correction échouée", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
