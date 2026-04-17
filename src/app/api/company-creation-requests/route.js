import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";

function normalizePayload(body = {}) {
  return {
    requestedName: body?.requestedName?.toString?.().trim() || "",
    address: body?.address?.toString?.().trim() || null,
    legalForm: body?.legalForm?.toString?.().trim() || null,
    currency: (body?.currency || process.env.DEFAULT_COMPANY_CURRENCY || "XOF")
      .toString()
      .trim()
      .toUpperCase(),
    rccmNumber: body?.rccmNumber?.toString?.().trim() || null,
    idNatNumber: body?.idNatNumber?.toString?.().trim() || null,
    taxNumber: body?.taxNumber?.toString?.().trim() || null,
    cnssNumber: body?.cnssNumber?.toString?.().trim() || null,
    onemNumber: body?.onemNumber?.toString?.().trim() || null,
    inppNumber: body?.inppNumber?.toString?.().trim() || null,
    vatPolicy: body?.vatPolicy?.toString?.().trim() || null,
    country: body?.country?.toString?.().trim() || null,
    timezone: body?.timezone?.toString?.().trim() || null,
    fiscalYearStart: body?.fiscalYearStart?.toString?.().trim() || null,
  };
}

export async function GET(req) {
  const actor = await getRequestActor(req);
  if (!actor?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const role = await getRequestRole(req);
  const where = checkPerm("createCompany", role)
    ? {}
    : { requesterUserId: actor.userId };

  const requests = await prisma.companyCreationRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      requesterUser: { select: { id: true, email: true, username: true } },
      reviewedByUser: { select: { id: true, email: true, username: true } },
      createdCompany: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ requests });
}

export async function POST(req) {
  const actor = await getRequestActor(req);
  if (!actor?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const payload = normalizePayload(await req.json().catch(() => ({})));
  if (!payload.requestedName) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  const existingPending = await prisma.companyCreationRequest.findFirst({
    where: {
      requesterUserId: actor.userId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Une demande en attente existe déjà pour cet utilisateur." },
      { status: 409 },
    );
  }

  const request = await prisma.companyCreationRequest.create({
    data: {
      requesterUserId: actor.userId,
      ...payload,
    },
    select: {
      id: true,
      status: true,
      requestedName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
