import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isDemoCompany } from "@/lib/demoCompany";
import { getRequestActor, getUserIdFromRequest } from "@/lib/requestAuth";

// GET /api/companies/public
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const context = searchParams.get("context") || searchParams.get("scope") || "";
    const forcePublicList = ["auth", "signin", "signup", "public"].includes(context);
    let actor = null;
    if (!forcePublicList && getUserIdFromRequest(req)) {
      try {
        actor = await getRequestActor(req);
      } catch (actorError) {
        console.warn("GET /api/companies/public actor lookup ignored", actorError);
      }
    }
    const isPlatformAdmin = actor?.user?.role === "PLATFORM_ADMIN";
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, legalForm: true, currency: true, address: true },
    });
    const accessibleCompanyIds = new Set(actor?.user?.memberships?.map((item) => item.companyId) || []);
    const visibleCompanies = companies.filter((company) => {
      if (forcePublicList) return isDemoCompany(company);
      if (actor?.user && !isPlatformAdmin) return accessibleCompanyIds.has(company.id);
      return true;
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
