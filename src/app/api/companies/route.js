import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm, getUserRole } from "@/lib/authz";

// GET /api/companies
export async function GET(req) {
  const role = await getUserRole(req);
  if (!checkPerm("manageUsers", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      legalForm: true,
      currency: true,
      vatPolicy: true,
      country: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ companies });
}

// POST /api/companies
export async function POST(req) {
  const role = await getUserRole(req);
  if (!checkPerm("manageUsers", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = body?.name?.toString?.().trim();
  if (!name) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  const legalForm = body.legalForm ? String(body.legalForm).trim() : null;
  const currency = (body.currency || process.env.DEFAULT_COMPANY_CURRENCY || "XOF")
    .toString()
    .trim()
    .toUpperCase();
  const data = {
    name,
    legalForm,
    currency,
    vatPolicy: body.vatPolicy ? String(body.vatPolicy).trim() : null,
    country: body.country ? String(body.country).trim() : null,
    timezone: body.timezone ? String(body.timezone).trim() : null,
    fiscalYearStart: body.fiscalYearStart ? String(body.fiscalYearStart).trim() : null,
  };
  const company = await prisma.company.create({
    data,
    select: {
      id: true,
      name: true,
      legalForm: true,
      currency: true,
      vatPolicy: true,
      country: true,
      timezone: true,
      fiscalYearStart: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ company }, { status: 201 });
}
