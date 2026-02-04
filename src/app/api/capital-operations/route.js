import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { nextSequence } from "@/lib/sequence";
import { requireCompanyId } from "@/lib/tenant";

export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const ops = await prisma.capitalOperation.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        subscriptions: {
          include: { shareholder: true },
        },
        calls: {
          include: { payments: true },
        },
      },
    });
    return NextResponse.json({ operations: ops });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Erreur liste opérations de capital" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const { type, form, nominalTarget, premiumTarget, resolutionDate, decisionRef, note } = body;
    if (!type || !form) {
      return NextResponse.json({ error: "type et form requis" }, { status: 400 });
    }
    if (!nominalTarget) {
      return NextResponse.json({ error: "nominalTarget requis" }, { status: 400 });
    }
    const op = await prisma.$transaction(async (tx) => {
      const ref = await nextSequence(tx, "CAPITAL_OP", "CAP-", companyId);
      return tx.capitalOperation.create({
        data: {
          ref,
          companyId,
          type,
          form,
          nominalTarget: nominalTarget.toString(),
          premiumTarget: premiumTarget != null ? premiumTarget.toString() : undefined,
          resolutionDate: resolutionDate ? new Date(resolutionDate) : undefined,
          decisionRef,
          note,
        },
      });
    });
    return NextResponse.json(op, { status: 201 });
  } catch (e) {
    const msg = e.message || "Erreur création opération de capital";
    const status = msg.toLowerCase().includes("requis") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
