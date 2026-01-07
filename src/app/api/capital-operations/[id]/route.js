import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { postCapitalRegularization } from "@/lib/capitalPosting";

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const op = await prisma.capitalOperation.findUnique({
      where: { id },
      include: {
        subscriptions: { include: { shareholder: true, calls: true } },
        calls: { include: { payments: true, subscription: { include: { shareholder: true } } } },
      },
    });
    if (!op) return NextResponse.json({ error: "Opération introuvable" }, { status: 404 });
    return NextResponse.json(op);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur lecture opération" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { status, note, regularize } = body;
    const op = await prisma.$transaction(async (tx) => {
      const updated = await tx.capitalOperation.update({
        where: { id },
        data: {
          status,
          note,
        },
      });
      // Régularisation finale (Dr 1012 / Cr 1013) si demandé et si status = REGISTERED
      if (regularize && status === "REGISTERED") {
        const calls = await tx.capitalCall.findMany({
          where: { capitalOperationId: id },
          include: { payments: true },
        });
        const totalCalled = calls.reduce((s, c) => s + Number(c.amountCalled || 0), 0);
        const totalPaid = calls.reduce(
          (s, c) => s + (c.payments || []).reduce((p, pay) => p + Number(pay.amount || 0), 0),
          0
        );
        const toRegularize = Math.min(totalCalled, totalPaid);
        if (toRegularize > 0) {
          try {
            await postCapitalRegularization(tx, { capitalOperationId: id, amount: toRegularize });
          } catch (err) {
            throw new Error(`Régularisation échouée : ${err.message || err}`);
          }
        }
      }
      return updated;
    });
    return NextResponse.json(op);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erreur mise à jour" }, { status: 500 });
  }
}
