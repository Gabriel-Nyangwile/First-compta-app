import { NextResponse } from "next/server";
import { getSupplierTreasuryDetail } from "@/lib/serverActions/money";

export async function GET(req, { params }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "supplierId requis" }, { status: 400 });
  }

  try {
    const detail = await getSupplierTreasuryDetail({ supplierId: id });
    if (!detail) {
      return NextResponse.json(
        { error: "Fournisseur introuvable" },
        { status: 404 }
      );
    }
    return NextResponse.json(sanitize(detail));
  } catch (error) {
    console.error("getSupplierTreasuryDetail failed", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

function sanitize(detail) {
  return {
    supplier: {
      ...detail.supplier,
      paymentDelay: normalizeNumberOptional(detail.supplier?.paymentDelay),
    },
    summary: { ...detail.summary },
    invoices: detail.invoices.map((inv) => ({
      ...inv,
      total: normalizeNumber(inv.total),
      paid: normalizeNumber(inv.paid),
      outstanding: normalizeNumber(inv.outstanding),
    })),
    payments: detail.payments.map((payment) => ({
      ...payment,
      amount: normalizeNumber(payment.amount),
      transactions: (payment.transactions || []).map((tx) => ({
        ...tx,
        amount: normalizeNumber(tx.amount),
      })),
    })),
    paymentsLimited: detail.paymentsLimited,
    timeline: detail.timeline.map((event) => ({
      ...event,
      delta: normalizeNumber(event.delta),
      balanceAfter: normalizeNumber(event.balanceAfter),
      meta: sanitizeMeta(event.meta),
    })),
  };
}

function normalizeNumber(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  if (value?.toNumber) return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNumberOptional(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  if (value?.toNumber) return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeMeta(meta) {
  if (!meta) return null;
  return {
    ...meta,
    outstanding: normalizeNumberOptional(meta.outstanding),
  };
}
