import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/tenant";
import { checkPerm, getUserRole } from "@/lib/authz";
import {
  approveProfitAllocation,
  calculateProfitAllocation,
} from "@/lib/closing/profitAllocation";

async function requireClosingPermission(request) {
  const role = await getUserRole(request);
  if (!checkPerm("manageClosing", role)) {
    const error = new Error("Accès refusé : rôle insuffisant");
    error.status = 403;
    throw error;
  }
}

function parseInput(source) {
  return {
    corporateTaxRate: source.get?.("corporateTaxRate") ?? source.corporateTaxRate,
    minimumTaxRate: source.get?.("minimumTaxRate") ?? source.minimumTaxRate,
    legalReserveRate: source.get?.("legalReserveRate") ?? source.legalReserveRate,
    legalReserveCapRate: source.get?.("legalReserveCapRate") ?? source.legalReserveCapRate,
    irmRate: source.get?.("irmRate") ?? source.irmRate,
    statutoryReserveAmount: source.get?.("statutoryReserveAmount") ?? source.statutoryReserveAmount,
    optionalReserveAmount: source.get?.("optionalReserveAmount") ?? source.optionalReserveAmount,
    dividendsGrossAmount: source.get?.("dividendsGrossAmount") ?? source.dividendsGrossAmount,
    taxExpenseAccountNumber: source.get?.("taxExpenseAccountNumber") ?? source.taxExpenseAccountNumber,
    minimumTaxExpenseAccountNumber:
      source.get?.("minimumTaxExpenseAccountNumber") ?? source.minimumTaxExpenseAccountNumber,
    taxPayableAccountNumber: source.get?.("taxPayableAccountNumber") ?? source.taxPayableAccountNumber,
    legalReserveAccountNumber: source.get?.("legalReserveAccountNumber") ?? source.legalReserveAccountNumber,
    statutoryReserveAccountNumber:
      source.get?.("statutoryReserveAccountNumber") ?? source.statutoryReserveAccountNumber,
    optionalReserveAccountNumber:
      source.get?.("optionalReserveAccountNumber") ?? source.optionalReserveAccountNumber,
    retainedEarningsAccountNumber:
      source.get?.("retainedEarningsAccountNumber") ?? source.retainedEarningsAccountNumber,
    lossRetainedAccountNumber: source.get?.("lossRetainedAccountNumber") ?? source.lossRetainedAccountNumber,
    dividendsPayableAccountNumber:
      source.get?.("dividendsPayableAccountNumber") ?? source.dividendsPayableAccountNumber,
    irmPayableAccountNumber: source.get?.("irmPayableAccountNumber") ?? source.irmPayableAccountNumber,
    decisionDate: source.get?.("decisionDate") ?? source.decisionDate,
    agoReference: source.get?.("agoReference") ?? source.agoReference,
  };
}

export async function GET(request) {
  try {
    await requireClosingPermission(request);
    const companyId = requireCompanyId(request);
    const { searchParams } = new URL(request.url);
    const report = await calculateProfitAllocation({
      companyId,
      year: Number(searchParams.get("year")),
      input: parseInput(searchParams),
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("GET /api/closing/profit-allocation error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur simulation affectation" },
      { status: error.status || 400 },
    );
  }
}

export async function POST(request) {
  try {
    await requireClosingPermission(request);
    const companyId = requireCompanyId(request);
    const body = await request.json().catch(() => ({}));
    const decision = await approveProfitAllocation({
      companyId,
      year: Number(body.year),
      input: parseInput(body),
    });
    return NextResponse.json({ ok: true, decision }, { status: 201 });
  } catch (error) {
    console.error("POST /api/closing/profit-allocation error", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur validation affectation" },
      { status: error.status || 400 },
    );
  }
}
