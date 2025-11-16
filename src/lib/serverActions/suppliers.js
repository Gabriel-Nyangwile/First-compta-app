"use server";

import prisma from "@/lib/prisma";
import { matchSupplierPayment } from "@/lib/lettering/matchSupplierPayment";

export async function matchSupplierPaymentAction({ movementId }) {
  if (!movementId) throw new Error("movementId requis");

  const movement = await prisma.moneyMovement.findUnique({
    where: { id: movementId },
    select: {
      id: true,
      kind: true,
      supplierId: true,
    },
  });

  if (!movement) throw new Error("Mouvement introuvable");
  if (movement.kind !== "SUPPLIER_PAYMENT") {
    throw new Error("Lettrage supplier seulement disponible sur les paiements fournisseurs");
  }

  const result = await matchSupplierPayment({ movementId });
  return result;
}
