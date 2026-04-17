import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";

// GET /api/companies
export async function GET(req) {
  const actor = await getRequestActor(req);
  const role = await getRequestRole(req);
  const canSelfCreate = !!actor?.user?.canCreateCompany;
  if (!checkPerm("createCompany", role) && !canSelfCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (canSelfCreate && !checkPerm("createCompany", role)) {
    return NextResponse.json({ companies: [], selfServiceCreate: true });
  }
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      legalForm: true,
      currency: true,
      rccmNumber: true,
      idNatNumber: true,
      taxNumber: true,
      cnssNumber: true,
      onemNumber: true,
      inppNumber: true,
      vatPolicy: true,
      country: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ companies });
}

// POST /api/companies
export async function POST(req) {
  const actor = await getRequestActor(req);
  const role = await getRequestRole(req);
  const canSelfCreate = !!actor?.user?.canCreateCompany;
  if (!checkPerm("createCompany", role) && !canSelfCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = body?.name?.toString?.().trim();
  if (!name) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  const rccmNumber = body?.rccmNumber?.toString?.().trim();
  const idNatNumber = body?.idNatNumber?.toString?.().trim();
  const taxNumber = body?.taxNumber?.toString?.().trim();
  const cnssNumber = body?.cnssNumber?.toString?.().trim();
  const onemNumber = body?.onemNumber?.toString?.().trim();
  const inppNumber = body?.inppNumber?.toString?.().trim();
  if (!rccmNumber || !idNatNumber || !taxNumber || !cnssNumber || !onemNumber || !inppNumber) {
    return NextResponse.json(
      { error: "RCCM, IdNat, N° Impôt, CNSS, ONEM et INPP sont obligatoires" },
      { status: 400 }
    );
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
    address: body.address ? String(body.address).trim() : null,
    rccmNumber,
    idNatNumber,
    taxNumber,
    cnssNumber,
    onemNumber,
    inppNumber,
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
      address: true,
      legalForm: true,
      currency: true,
      rccmNumber: true,
      idNatNumber: true,
      taxNumber: true,
      cnssNumber: true,
      onemNumber: true,
      inppNumber: true,
      vatPolicy: true,
      country: true,
      timezone: true,
      fiscalYearStart: true,
      createdAt: true,
    },
  });
  if (actor?.userId) {
    await prisma.companyMembership.upsert({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: actor.userId,
        },
      },
      update: {
        role: canSelfCreate ? "SUPERADMIN" : role,
        isActive: true,
      },
      create: {
        companyId: company.id,
        userId: actor.userId,
        role: canSelfCreate ? "SUPERADMIN" : role,
        isActive: true,
        isDefault: true,
      },
    });
    await prisma.user.update({
      where: { id: actor.userId },
      data: {
        companyId: actor.user?.companyId || company.id,
        canCreateCompany: false,
      },
    });
  }
  return NextResponse.json({ company }, { status: 201 });
}
