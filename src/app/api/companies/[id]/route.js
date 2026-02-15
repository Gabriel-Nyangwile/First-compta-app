import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm, getUserRole } from "@/lib/authz";

export async function PATCH(req, { params }) {
  const role = await getUserRole(req);
  if (!checkPerm("manageUsers", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: "id requis" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.legalForm != null) data.legalForm = String(body.legalForm).trim() || null;
  if (body.currency != null) data.currency = String(body.currency).trim().toUpperCase();
  if (body.vatPolicy != null) data.vatPolicy = String(body.vatPolicy).trim() || null;
  if (body.country != null) data.country = String(body.country).trim() || null;
  if (body.timezone != null) data.timezone = String(body.timezone).trim() || null;
  if (body.fiscalYearStart != null) data.fiscalYearStart = String(body.fiscalYearStart).trim() || null;

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
  }

  try {
    const company = await prisma.company.update({
      where: { id },
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
    return NextResponse.json({ company });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
