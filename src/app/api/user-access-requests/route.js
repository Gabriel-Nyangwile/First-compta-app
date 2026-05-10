import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";

export async function GET(req) {
  const actor = await getRequestActor(req);
  if (!actor?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const role = await getRequestRole(req);
  const { searchParams } = new URL(req.url);
  const requestedCompanyId = searchParams.get("companyId") || actor.companyId;
  const status = searchParams.get("status") || undefined;

  let where = {};
  if (checkPerm("createCompany", role)) {
    where = {
      ...(requestedCompanyId ? { companyId: requestedCompanyId } : {}),
      ...(status ? { status } : {}),
    };
  } else if (role === "SUPERADMIN") {
    if (!requestedCompanyId) {
      return NextResponse.json({ error: "companyId requis" }, { status: 400 });
    }
    where = {
      companyId: requestedCompanyId,
      ...(status ? { status } : {}),
    };
  } else {
    where = {
      requesterUserId: actor.userId,
      ...(status ? { status } : {}),
    };
  }

  const requests = await prisma.userAccessRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      requesterUser: { select: { id: true, email: true, username: true } },
      reviewedByUser: { select: { id: true, email: true, username: true } },
      company: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ requests });
}
