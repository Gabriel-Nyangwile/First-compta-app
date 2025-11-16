"use server";

import prisma from "@/lib/prisma";
import { matchClientPayment } from "@/lib/lettering/matchClientPayment";

export async function matchClientPaymentAction({ movementId }) {
  if (!movementId) throw new Error("movementId requis");

  const movement = await prisma.moneyMovement.findUnique({
    where: { id: movementId },
    select: {
      id: true,
      kind: true,
    },
  });

  if (!movement) throw new Error("Mouvement introuvable");
  if (movement.kind !== "CLIENT_RECEIPT") {
    throw new Error("Lettrage client seulement disponible sur les encaissements clients");
  }

  const result = await matchClientPayment({ movementId });
  return result;
}
