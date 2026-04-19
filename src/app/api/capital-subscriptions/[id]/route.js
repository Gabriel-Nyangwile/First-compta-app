import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  buildCapitalSourcePrefix,
  postCapitalSubscription,
  postCapitalSubscriptionAdjustment,
} from "@/lib/capitalPosting";
import { requireCompanyId } from "@/lib/tenant";

export async function PATCH(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { nominalAmount, premiumAmount, sharesCount, note } = body;
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.capitalSubscription.findFirst({
        where: { id, companyId },
        include: {
          calls: {
            select: { amountCalled: true },
          },
        },
      });
      if (!existing) {
        throw new Error("Souscription introuvable");
      }
      const nextNominal =
        nominalAmount != null
          ? Number(nominalAmount)
          : Number(existing.nominalAmount?.toNumber?.() ?? existing.nominalAmount ?? 0);
      const totalCalled = existing.calls.reduce(
        (sum, call) => sum + Number(call.amountCalled?.toNumber?.() ?? call.amountCalled ?? 0),
        0
      );
      if (nextNominal + 0.001 < totalCalled) {
        throw new Error(
          `Montant nominal incohérent : ${nextNominal} inférieur aux appels déjà saisis (${totalCalled})`
        );
      }
      const saved = await tx.capitalSubscription.update({
        where: { id },
        data: {
          nominalAmount: nominalAmount != null ? nominalAmount.toString() : undefined,
          premiumAmount: premiumAmount != null ? premiumAmount.toString() : undefined,
          sharesCount: sharesCount != null ? Number(sharesCount) : undefined,
          note: note ?? undefined,
        },
        include: {
          shareholder: true,
          calls: true,
        },
      });
      const previousNominal = Number(
        existing.nominalAmount?.toNumber?.() ?? existing.nominalAmount ?? 0
      );
      const deltaNominal = nextNominal - previousNominal;
      if (Math.abs(deltaNominal) >= 0.01) {
        await postCapitalSubscriptionAdjustment(tx, {
          subscription: saved,
          deltaNominal,
          companyId,
        });
      }
      return saved;
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e.message || "Erreur mise à jour souscription";
    const status =
      msg.toLowerCase().includes("introuvable") ? 404 : msg.toLowerCase().includes("incohérent") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// (Re)poster la promesse de souscription : Dr 4612 / Cr 1012 sur le nominal
export async function POST(_req, { params }) {
  const companyId = requireCompanyId(_req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const sub = await prisma.capitalSubscription.findFirst({
      where: { id, companyId },
      include: { calls: { select: { amountCalled: true } } },
    });
    if (!sub) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      const sourcePrefix = buildCapitalSourcePrefix("subscription", id);
      const existingTxns = await tx.transaction.findMany({
        where: {
          companyId,
          kind: "CAPITAL_SUBSCRIPTION",
          OR: [
            { journalEntry: { sourceId: { startsWith: sourcePrefix } } },
            { description: { contains: id } },
          ],
        },
        select: { id: true, journalEntryId: true },
      });
      const txnIds = existingTxns.map((entry) => entry.id);
      const jeIds = [...new Set(existingTxns.map((entry) => entry.journalEntryId).filter(Boolean))];
      if (txnIds.length) {
        await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      }
      if (jeIds.length) {
        await tx.journalEntry.deleteMany({ where: { id: { in: jeIds }, companyId } });
      }
      const called = 0;
      const notCalled = Number(sub.nominalAmount?.toNumber?.() ?? sub.nominalAmount ?? 0);
      await postCapitalSubscription(tx, {
        subscription: sub,
        amountCalled: called,
        amountNotCalled: notCalled,
        companyId,
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e.message || "Erreur post promesse";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      // Bloque si des appels ou paiements existent
      const calls = await tx.capitalCall.count({
        where: { subscriptionId: id, companyId },
      });
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
          OR: [
            { journalEntry: { sourceId: { startsWith: buildCapitalSourcePrefix("subscription", id) } } },
            { description: { contains: id } },
          ],
          companyId,
        },
      });
      const jeIds = [...new Set(txns.map((t) => t.journalEntryId).filter(Boolean))];
      const txnIds = txns.map((t) => t.id);
      if (txnIds.length) {
        await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      }
      if (jeIds.length) {
        await tx.journalEntry.deleteMany({
          where: { id: { in: jeIds }, companyId },
        });
      }
      await tx.capitalSubscription.deleteMany({ where: { id, companyId } });
      return { ok: true, txDeleted: txnIds.length, jeDeleted: jeIds.length };
    });
    if (deleted instanceof NextResponse) return deleted;
    return NextResponse.json(deleted);
  } catch (e) {
    const msg = e.message || "Erreur suppression souscription";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
