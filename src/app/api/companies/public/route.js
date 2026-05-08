import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/companies/public
export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, legalForm: true, currency: true, address: true },
    });
    return NextResponse.json({ companies });
  } catch (error) {
    console.error("GET /api/companies/public failed", error);
    return NextResponse.json(
      {
        error: "Impossible de charger les societes.",
        code: error?.code || "COMPANIES_PUBLIC_ERROR",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
