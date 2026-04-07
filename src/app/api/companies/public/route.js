import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/companies/public
export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, legalForm: true, currency: true, address: true },
  });
  return NextResponse.json({ companies });
}
