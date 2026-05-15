import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";
import { reviewVisibleAfter } from "@/lib/accessReview";

export async function POST(req, { params }) {
  const actor = await getRequestActor(req);
  const role = await getRequestRole(req);
  if (!actor?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!checkPerm("createCompany", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const reviewNote = body?.reviewNote?.toString?.().trim() || "Approved";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.companyCreationRequest.findUnique({
        where: { id },
      });
      if (!request) {
        throw new Error("Demande introuvable");
      }
      if (request.status !== "PENDING") {
        throw new Error("Seules les demandes PENDING peuvent être approuvées");
      }

      const company = await tx.company.create({
        data: {
          name: request.requestedName,
          address: request.address,
          legalForm: request.legalForm,
          currency: request.currency,
          rccmNumber: request.rccmNumber,
          idNatNumber: request.idNatNumber,
          taxNumber: request.taxNumber,
          cnssNumber: request.cnssNumber,
          onemNumber: request.onemNumber,
          inppNumber: request.inppNumber,
          vatPolicy: request.vatPolicy,
          country: request.country,
          timezone: request.timezone,
          fiscalYearStart: request.fiscalYearStart,
        },
      });

      await tx.companyMembership.upsert({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: request.requesterUserId,
          },
        },
        update: {
          role: "SUPERADMIN",
          isActive: false,
          isDefault: true,
        },
        create: {
          companyId: company.id,
          userId: request.requesterUserId,
          role: "SUPERADMIN",
          isActive: false,
          isDefault: true,
        },
      });

      const requester = await tx.user.findUnique({
        where: { id: request.requesterUserId },
        select: { companyId: true },
      });

      if (!requester?.companyId) {
        await tx.user.update({
          where: { id: request.requesterUserId },
          data: { companyId: company.id },
        });
      }

      const updatedRequest = await tx.companyCreationRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          createdCompanyId: company.id,
          reviewedByUserId: actor.userId,
          reviewedAt: new Date(),
          visibleAfterAt: reviewVisibleAfter(),
          reviewNote,
        },
        include: {
          createdCompany: { select: { id: true, name: true } },
        },
      });

      return updatedRequest;
    });

    return NextResponse.json({ request: result });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Approval failed" }, { status: 400 });
  }
}
