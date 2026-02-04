import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { postCapitalCall } from "@/lib/capitalPosting";
import { requireCompanyId } from "@/lib/tenant";

export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const { capitalOperationId, subscriptionId, amountCalled, dueDate, label } = body;
    if (!capitalOperationId || amountCalled == null) {
      return NextResponse.json({ error: "capitalOperationId et amountCalled requis" }, { status: 400 });
    }
    const nextNumber = await prisma.capitalCall.aggregate({
      where: { capitalOperationId, companyId },
      _max: { callNumber: true },
    });
    const callNumber = (nextNumber._max.callNumber || 0) + 1;
    const call = await prisma.$transaction(async (tx) => {
      const op = await tx.capitalOperation.findFirst({
        where: { id: capitalOperationId, companyId },
        select: { id: true },
      });
      if (!op) throw new Error("Opération introuvable");
      if (subscriptionId) {
        const sub = await tx.capitalSubscription.findFirst({
          where: { id: subscriptionId, companyId },
          select: { id: true },
        });
        if (!sub) throw new Error("Souscription introuvable");
      }
      const created = await tx.capitalCall.create({
        data: {
          capitalOperationId,
          subscriptionId: subscriptionId || null,
          callNumber,
          label: label || `Appel ${callNumber}`,
          amountCalled: amountCalled.toString(),
          dueDate: dueDate ? new Date(dueDate) : null,
          companyId,
        },
        include: { payments: true, subscription: { include: { shareholder: true } } },
      });
      // Posting comptable de l'appel (4612/109 et 1011/1012)
      await postCapitalCall(tx, { call: created, companyId });
      return created;
    });
    return NextResponse.json(call, { status: 201 });
  } catch (e) {
    const msg = e.message || "Erreur création appel de fonds";
    const status = msg.toLowerCase().includes("requis") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
