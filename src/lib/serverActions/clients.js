"use server";

import prisma from "@/lib/prisma";
import { matchClientPayment } from "@/lib/lettering/matchClientPayment";
import { matchPartyInvoice } from "@/lib/lettering/matchPartyInvoice";

export async function matchClientPaymentAction({ movementId, companyId }) {
  if (!movementId) throw new Error("movementId requis");

  const movement = await prisma.moneyMovement.findFirst({
    where: { id: movementId, ...(companyId ? { companyId } : {}) },
    select: {
      id: true,
      kind: true,
    },
  });

  if (!movement) throw new Error("Mouvement introuvable");
  if (movement.kind !== "CLIENT_RECEIPT") {
    throw new Error("Lettrage client seulement disponible sur les encaissements clients");
  }

  const result = await matchClientPayment({ movementId, companyId });
  return result;
}

export async function matchClientInvoiceAction({ invoiceId, companyId }) {
  if (!invoiceId) throw new Error("invoiceId requis");
  return matchPartyInvoice({ party: "client", invoiceId, companyId });
}
