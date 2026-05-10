import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCompanyIdFromRequest } from "@/lib/tenant";
import {
  activateApprovedAccessRequest,
  activateApprovedCompanyRequest,
  isVisibleNow,
  waitingDecisionMessage,
  waitingVisibilityMessage,
} from "@/lib/accessReview";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const normalizedEmail = body.email?.toString?.().trim().toLowerCase();
    const password = body.password?.toString?.() || "";
    let requestedCompanyId =
      (body.companyId && String(body.companyId).trim()) || getCompanyIdFromRequest(request);

    if (!normalizedEmail || !password) {
      return Response.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      include: {
        memberships: {
          where: { isActive: true },
          include: { company: { select: { id: true, name: true } } },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return Response.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const statusResult = await resolvePendingAccess(user, requestedCompanyId);
    if (statusResult instanceof Response) return statusResult;
    if (statusResult?.companyId) requestedCompanyId = statusResult.companyId;
    if (statusResult?.activated) {
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          memberships: {
            where: { isActive: true },
            include: { company: { select: { id: true, name: true } } },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          },
        },
      });
    }
    if (!user.isActive) {
      return Response.json(
        { error: waitingDecisionMessage(), code: "PENDING_REVIEW" },
        { status: 403 },
      );
    }

    const globalRole = user.role?.toString?.().toUpperCase();
    const isGlobalAdmin = ["PLATFORM_ADMIN", "SUPERADMIN"].includes(globalRole);
    const membership =
      requestedCompanyId && requestedCompanyId !== "NEW"
        ? user.memberships.find((item) => item.companyId === requestedCompanyId) || null
        : user.memberships.find((item) => item.isDefault) || user.memberships[0] || null;

    if (
      requestedCompanyId &&
      requestedCompanyId !== "NEW" &&
      !membership &&
      user.companyId !== requestedCompanyId &&
      !isGlobalAdmin
    ) {
      return Response.json(
        { error: "Accès refusé à cette société pour cet utilisateur" },
        { status: 403 },
      );
    }

    const activeCompanyId =
      requestedCompanyId === "NEW"
        ? "NEW"
        : membership?.companyId || (user.companyId === requestedCompanyId ? requestedCompanyId : user.companyId) || null;
    const activeRole =
      membership?.role || (user.companyId === activeCompanyId ? user.role : null) || (isGlobalAdmin ? user.role : null) || user.role;

    return Response.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: activeRole,
        companyId: activeCompanyId,
        isActive: user.isActive,
        canCreateCompany: user.canCreateCompany,
        memberships: user.memberships.map((item) => ({
          companyId: item.companyId,
          companyName: item.company?.name || null,
          role: item.role,
          isDefault: item.isDefault,
        })),
      },
    });
  } catch (error) {
    console.error("POST /api/auth/signin failed", error);
    return Response.json(
      { error: "Erreur connexion.", code: error?.code || "AUTH_SIGNIN_ERROR" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";

async function resolvePendingAccess(user, requestedCompanyId) {
  if (!requestedCompanyId) return null;
  const now = new Date();

  if (requestedCompanyId === "NEW") {
    const request = await prisma.companyCreationRequest.findFirst({
      where: {
        requesterUserId: user.id,
        status: { in: ["PENDING", "APPROVED", "REJECTED"] },
        resultDeliveredAt: null,
      },
      include: { createdCompany: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!request) return null;
    if (request.status === "PENDING") {
      return Response.json({ error: waitingDecisionMessage(), code: "PENDING_REVIEW" }, { status: 403 });
    }
    if (!isVisibleNow(request, now)) {
      return Response.json({ error: waitingVisibilityMessage(), code: `${request.status}_WAITING_DELAY` }, { status: 403 });
    }
    if (request.status === "REJECTED") {
      await prisma.companyCreationRequest.update({
        where: { id: request.id },
        data: { resultDeliveredAt: now },
      });
      return Response.json(
        { error: request.reviewNote || "Votre demande de création de société a été rejetée.", code: "REQUEST_REJECTED" },
        { status: 403 },
      );
    }
    if (request.status === "APPROVED") {
      await activateApprovedCompanyRequest(request);
      return { activated: true, companyId: request.createdCompanyId };
    }
  }

  const request = await prisma.userAccessRequest.findFirst({
    where: {
      requesterUserId: user.id,
      companyId: requestedCompanyId,
      status: { in: ["PENDING", "APPROVED", "REJECTED"] },
      resultDeliveredAt: null,
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!request) return null;
  if (request.status === "PENDING") {
    return Response.json({ error: waitingDecisionMessage(), code: "PENDING_REVIEW" }, { status: 403 });
  }
  if (!isVisibleNow(request, now)) {
    return Response.json({ error: waitingVisibilityMessage(), code: `${request.status}_WAITING_DELAY` }, { status: 403 });
  }
  if (request.status === "REJECTED") {
    await prisma.userAccessRequest.update({
      where: { id: request.id },
      data: { resultDeliveredAt: now },
    });
    return Response.json(
      { error: request.reviewNote || "Votre demande d'accès a été rejetée.", code: "REQUEST_REJECTED" },
      { status: 403 },
    );
  }
  if (request.status === "APPROVED") {
    await activateApprovedAccessRequest(request);
    return { activated: true };
  }
  return null;
}
