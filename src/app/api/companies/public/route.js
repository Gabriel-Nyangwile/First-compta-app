import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getRequestActor } from "@/lib/requestAuth";

function isStrategicDemo(company) {
  const normalized = company?.name
    ?.toString?.()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return normalized?.includes("strategic business demo") || normalized?.includes("strategic business");
}

// GET /api/companies/public
export async function GET(req) {
  try {
    const actor = await getRequestActor(req);
    const isPlatformAdmin = actor?.user?.role === "PLATFORM_ADMIN";
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, legalForm: true, currency: true, address: true },
    });
    const accessibleCompanyIds = new Set(actor?.user?.memberships?.map((item) => item.companyId) || []);
    const visibleCompanies = companies.filter((company) => {
      if (actor?.userId && !isPlatformAdmin) return accessibleCompanyIds.has(company.id);
      if (!isStrategicDemo(company)) return true;
      return isPlatformAdmin || accessibleCompanyIds.has(company.id);
    });
    return NextResponse.json({ companies: visibleCompanies });
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
