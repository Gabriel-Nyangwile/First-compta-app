import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { postCapitalSubscription } from "@/lib/capitalPosting";
import { requireCompanyId } from "@/lib/tenant";

export async function POST(req, { params }) {
  const companyId = requireCompanyId(req);
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "capitalOperationId requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { shareholderId, nominalAmount, premiumAmount, sharesCount, note } = body;
    if (!shareholderId || nominalAmount == null) {
      return NextResponse.json({ error: "shareholderId et nominalAmount requis" }, { status: 400 });
    }
    const sub = await prisma.$transaction(async (tx) => {
      const op = await tx.capitalOperation.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!op) throw new Error("Opération introuvable");
      const holder = await tx.shareholder.findFirst({
        where: { id: shareholderId, companyId },
        select: { id: true },
      });
      if (!holder) throw new Error("Associé introuvable");
      const created = await tx.capitalSubscription.create({
        data: {
          capitalOperationId: id,
          shareholderId,
          nominalAmount: nominalAmount.toString(),
          premiumAmount: premiumAmount != null ? premiumAmount.toString() : undefined,
          sharesCount: sharesCount != null ? Number(sharesCount) : undefined,
          note,
          companyId,
        },
        include: { shareholder: true, calls: true },
      });
      // Posting promesse : on considère tout le nominal comme "non appelé" (Dr 109 / Cr 1011)
      const called = 0;
      const notCalled = Number(nominalAmount || 0);
      await postCapitalSubscription(tx, {
        subscription: created,
        amountCalled: called,
        amountNotCalled: notCalled,
        companyId,
      });
      return created;
    });
    return NextResponse.json(sub, { status: 201 });
  } catch (e) {
    const msg = e.message || "Erreur création souscription";
    const status = msg.toLowerCase().includes("requis") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
