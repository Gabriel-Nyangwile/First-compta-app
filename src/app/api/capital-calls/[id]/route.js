import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { postCapitalCall } from "@/lib/capitalPosting";

// Mise à jour d'un appel de fonds (montant, échéance, libellé, souscription cible)
export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { amountCalled, dueDate, label, subscriptionId } = body;
    const updated = await prisma.$transaction(async (tx) => {
      const call = await tx.capitalCall.update({
        where: { id },
        data: {
          amountCalled: amountCalled != null ? amountCalled.toString() : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          label: label ?? undefined,
          subscriptionId: subscriptionId || null,
        },
      });
      // Optional: re-poster si souhaité (ici, on reposte si aucun paiement)
      const payments = await tx.capitalPayment.count({ where: { callId: id } });
      if (payments === 0 && amountCalled != null) {
        await postCapitalCall(tx, { call });
      }
      return call;
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e.message || "Erreur mise à jour appel de fonds";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Suppression d'un appel de fonds (interdit si paiements liés)
export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const call = await tx.capitalCall.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!call) return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
      if (call.payments?.length) {
        return NextResponse.json(
          { error: "Suppression impossible : paiements liés présents" },
          { status: 400 }
        );
      }
      // Supprimer les écritures comptables associées à cet appel (basées sur le kind CAPITAL_CALL)
      const txns = await tx.transaction.findMany({
        where: {
          kind: "CAPITAL_CALL",
          OR: [
            { description: { contains: call.id } },
            { description: { contains: String(call.callNumber ?? "") } },
          ],
        },
        include: { journalEntry: true },
      });
      const txnIds = txns.map((t) => t.id);
      const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
      if (txnIds.length) {
        await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      }
      if (jeIds.length) {
        await tx.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
      }
      await tx.capitalCall.delete({ where: { id } });
      return { ok: true };
    });
    if (deleted instanceof NextResponse) return deleted;
    return NextResponse.json(deleted);
  } catch (e) {
    const msg = e.message || "Erreur suppression appel de fonds";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
