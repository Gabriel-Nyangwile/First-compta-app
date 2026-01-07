import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Liste rapide des actionnaires
export async function GET() {
  try {
    const shareholders = await prisma.shareholder.findMany({
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

// Création rapide d'un actionnaire
export async function POST(req) {
  try {
    const body = await req.json();
    const { name, type = "INDIVIDUAL", email, phone, address } = body;
    if (!name) {
      return NextResponse.json({ error: "name requis" }, { status: 400 });
    }
    const shareholder = await prisma.shareholder.create({
      data: { name, type, email, phone, address },
    });
    return NextResponse.json(shareholder, { status: 201 });
  } catch (e) {
    const msg = e.message || "Erreur création actionnaire";
    const status = msg.toLowerCase().includes("requis") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
