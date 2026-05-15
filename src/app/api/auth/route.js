import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCompanyIdFromRequest } from "@/lib/tenant";
import {
  activateApprovedAccessRequest,
  activateApprovedCompanyRequest,
  isVisibleNow,
  pendingMessage,
  waitingDecisionMessage,
  waitingVisibilityMessage,
} from "@/lib/accessReview";
import { findDemoCompany, isDemoCompany } from "@/lib/demoCompany";

const allowedRoles = [
  "PLATFORM_ADMIN",
  "SUPERADMIN",
  "FINANCE_MANAGER",
  "ACCOUNTANT",
  "PROCUREMENT",
  "SALES",
  "HR_MANAGER",
  "PAYROLL_CLERK",
  "TREASURY",
  "VIEWER",
];

function normalizeRole(role) {
  const upper = role?.toString?.().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return "VIEWER";
  return allowedRoles.includes(upper) ? upper : "VIEWER";
}

// Inscription (signup)
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, email, password } = body;
    const normalizedEmail = email?.toString?.().trim().toLowerCase();
    const requestedCompanyId = body.companyId?.toString?.().trim() || "";
    if (!username || !normalizedEmail || !password) {
      return Response.json({ error: "Champs requis manquants" }, { status: 400 });
    }
    if (!requestedCompanyId) {
      return Response.json({ error: "Sélectionnez une société ou une demande de nouvelle société." }, { status: 400 });
    }
    if (requestedCompanyId === "NEW" && !body.companyRequest?.requestedName?.toString?.().trim()) {
      return Response.json({ error: "Nom de la nouvelle société requis" }, { status: 400 });
    }
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existing) {
      return Response.json({ error: "Email déjà utilisé" }, { status: 409 });
    }
    const publicCompanies = await prisma.company.findMany({ select: { id: true, name: true } });
    const demoCompany = findDemoCompany(publicCompanies);
    const requestedExistingCompany =
      requestedCompanyId === "NEW" ? null : publicCompanies.find((company) => company.id === requestedCompanyId) || null;
    if (requestedCompanyId !== "NEW") {
      const company = requestedExistingCompany;
      if (!company) return Response.json({ error: "Société introuvable" }, { status: 404 });
      if (!isDemoCompany(company)) {
        return Response.json(
          { error: "L'inscription publique donne uniquement accès à la société Démo. Pour une nouvelle société, utilisez l'option dédiée." },
          { status: 403 },
        );
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const demoCompanyId = demoCompany?.id || requestedExistingCompany?.id || null;
      const user = await tx.user.create({
        data: {
          username,
          email: normalizedEmail,
          password: hashed,
          role: "VIEWER",
          isActive: Boolean(demoCompanyId),
          canCreateCompany: false,
          companyId: demoCompanyId,
        },
      });

      if (demoCompanyId) {
        await tx.companyMembership.create({
          data: {
            companyId: demoCompanyId,
            userId: user.id,
            role: "VIEWER",
            isActive: true,
            isDefault: true,
          },
        });
      }

      if (requestedCompanyId === "NEW") {
        const companyRequest = body.companyRequest || {};
        const accessRequest = await tx.companyCreationRequest.create({
          data: {
            requesterUserId: user.id,
            requestedName: companyRequest.requestedName.toString().trim(),
            reason: companyRequest.reason?.toString?.().trim() || null,
            address: companyRequest.address?.toString?.().trim() || null,
            legalForm: companyRequest.legalForm?.toString?.().trim() || null,
            currency: (companyRequest.currency || process.env.DEFAULT_COMPANY_CURRENCY || "CDF")
              .toString()
              .trim()
              .toUpperCase(),
            rccmNumber: companyRequest.rccmNumber?.toString?.().trim() || null,
            idNatNumber: companyRequest.idNatNumber?.toString?.().trim() || null,
            taxNumber: companyRequest.taxNumber?.toString?.().trim() || null,
            cnssNumber: companyRequest.cnssNumber?.toString?.().trim() || null,
            onemNumber: companyRequest.onemNumber?.toString?.().trim() || null,
            inppNumber: companyRequest.inppNumber?.toString?.().trim() || null,
            vatPolicy: companyRequest.vatPolicy?.toString?.().trim() || null,
            country: companyRequest.country?.toString?.().trim() || null,
            timezone: companyRequest.timezone?.toString?.().trim() || null,
            fiscalYearStart: companyRequest.fiscalYearStart?.toString?.().trim() || null,
          },
        });
        return { user, request: accessRequest, kind: "COMPANY_CREATION" };
      }

      return {
        user,
        request: {
          id: user.id,
          status: "APPROVED",
          createdAt: user.createdAt,
        },
        kind: "DEMO_ACCESS",
      };
    });

    return Response.json(
      {
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          isActive: result.user.isActive,
          canCreateCompany: result.user.canCreateCompany,
        },
        request: {
          id: result.request.id,
          kind: result.kind,
          status: result.request.status,
          createdAt: result.request.createdAt,
        },
        message:
          result.kind === "DEMO_ACCESS"
            ? "Inscription activée. Vous pouvez parcourir la société Démo en lecture seule."
            : pendingMessage(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/auth failed", error);
    return Response.json(
      { error: "Erreur inscription.", code: error?.code || "AUTH_SIGNUP_ERROR" },
      { status: 500 },
    );
  }
}

// Connexion (signin)
export async function GET(request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { email, password } = params;
    const normalizedEmail = email?.toString?.().trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return Response.json({ error: "Champs requis manquants" }, { status: 400 });
    }
    let requestedCompanyId =
      (params.companyId && String(params.companyId).trim()) || getCompanyIdFromRequest(request);
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
    const isPlatformAdmin = globalRole === "PLATFORM_ADMIN";
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
      (isPlatformAdmin ? user.role : null) ||
      membership?.role ||
      (user.companyId === activeCompanyId ? user.role : null) ||
      (isGlobalAdmin ? user.role : null) ||
      user.role;
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
    console.error("GET /api/auth failed", error);
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
