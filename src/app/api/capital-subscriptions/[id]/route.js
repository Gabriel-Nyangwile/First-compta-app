import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { postCapitalSubscription } from "@/lib/capitalPosting";

export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { nominalAmount, premiumAmount, sharesCount, note } = body;
    const sub = await prisma.capitalSubscription.update({
      where: { id },
      data: {
        nominalAmount: nominalAmount != null ? nominalAmount.toString() : undefined,
        premiumAmount: premiumAmount != null ? premiumAmount.toString() : undefined,
        sharesCount: sharesCount != null ? Number(sharesCount) : undefined,
        note: note ?? undefined,
      },
    });
    return NextResponse.json(sub);
  } catch (e) {
    const msg = e.message || "Erreur mise à jour souscription";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// (Re)poster la promesse de souscription : Dr 4612 / Cr 1012 sur le nominal
export async function POST(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const sub = await prisma.capitalSubscription.findUnique({ where: { id } });
    if (!sub) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      const called = Number(sub.nominalAmount || 0);
      const notCalled = 0;
      await postCapitalSubscription(tx, { subscription: sub, amountCalled: called, amountNotCalled: notCalled });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e.message || "Erreur post promesse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      // Bloque si des appels ou paiements existent
      const calls = await tx.capitalCall.count({ where: { subscriptionId: id } });
      if (calls > 0) {
        return NextResponse.json(
          { error: "Suppression impossible : appels de fonds liés présents" },
          { status: 400 }
        );
      }
      // Supprimer les écritures comptables associées (basées sur la description contenant l'id)
      const txns = await tx.transaction.findMany({
        where: {
          kind: "CAPITAL_SUBSCRIPTION",
          description: { contains: id },
        },
      });
      const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
      const txnIds = txns.map((t) => t.id);
      if (txnIds.length) {
        await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      }
      if (jeIds.length) {
        await tx.journalEntry.deleteMany({ where: { id: { in: jeIds } } });
      }
      await tx.capitalSubscription.delete({ where: { id } });
      return { ok: true, txDeleted: txnIds.length, jeDeleted: jeIds.length };
    });
    if (deleted instanceof NextResponse) return deleted;
    return NextResponse.json(deleted);
  } catch (e) {
    const msg = e.message || "Erreur suppression souscription";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
