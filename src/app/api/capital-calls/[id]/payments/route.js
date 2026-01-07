import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { postCapitalPayment } from "@/lib/capitalPosting";

export async function POST(req, { params }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "call id requis" }, { status: 400 });
  try {
    const body = await req.json();
    const { amount, paymentDate, method = "BANK", note, accountId } = body;
    if (amount == null) return NextResponse.json({ error: "amount requis" }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: "accountId requis" }, { status: 400 });

    // Vérifier compte 52xx ou 57xx selon la méthode
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: "Compte introuvable" }, { status: 400 });
    const num = account.number || "";
    const isBank = method === "BANK";
    if (isBank && !num.startsWith("52")) {
      return NextResponse.json({ error: "Compte banque (52xxxx) requis" }, { status: 400 });
    }
    if (!isBank && !num.startsWith("57")) {
      return NextResponse.json({ error: "Compte caisse (57xxxx) requis" }, { status: 400 });
    }

    const payment = await prisma.$transaction(async (tx) => {
      const pay = await tx.capitalPayment.create({
        data: {
          callId: id,
          accountId,
          amount: amount.toString(),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          method,
          note,
        },
      });
      await postCapitalPayment(tx, { payment: pay, account });
      // Recalcule le statut de l'appel
      const call = await tx.capitalCall.findUnique({
        where: { id },
        include: { payments: true },
      });
      const totalPaid = (call?.payments || []).reduce((s, p) => s + Number(p.amount), 0);
      const amountCalled = Number(call?.amountCalled || 0);
      const newStatus =
        totalPaid >= amountCalled && amountCalled > 0
          ? "PAID"
          : totalPaid > 0
          ? "PARTIAL"
          : "OPEN";
      await tx.capitalCall.update({
        where: { id },
        data: { status: newStatus },
      });
      return pay;
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    const msg = e.message || "Erreur enregistrement paiement";
    const status = msg.toLowerCase().includes("requis") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
