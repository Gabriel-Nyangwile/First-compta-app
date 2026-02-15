import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCompanyId } from "@/lib/tenant";

// Liste rapide des associes/actionnaires
export async function GET(req) {
  try {
    const companyId = requireCompanyId(req);
    const shareholders = await prisma.shareholder.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ shareholders });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Erreur liste actionnaires" },
      { status: 500 }
    );
  }
}

// Creation rapide d'un actionnaire
export async function POST(req) {
  try {
    const companyId = requireCompanyId(req);
    const body = await req.json();
    const { name, type = "INDIVIDUAL", email, phone, address } = body;
    if (!name) {
      return NextResponse.json({ error: "name requis" }, { status: 400 });
    }
    const shareholder = await prisma.shareholder.create({
      data: { companyId, name, type, email, phone, address },
    });
    return NextResponse.json(shareholder, { status: 201 });
  } catch (e) {
    const msg = e.message || "Erreur creation actionnaire";
    const status = msg.toLowerCase().includes("requis") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
