import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCompanyIdFromRequest } from "@/lib/tenant";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const normalizedEmail = body.email?.toString?.().trim().toLowerCase();
    const password = body.password?.toString?.() || "";
    const requestedCompanyId =
      (body.companyId && String(body.companyId).trim()) || getCompanyIdFromRequest(request);

    if (!normalizedEmail || !password) {
      return Response.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
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
    if (!user.isActive) {
      return Response.json(
        { error: "Compte en attente d'approbation par le PLATFORM_ADMIN." },
        { status: 403 },
      );
    }

    const membership =
      requestedCompanyId && requestedCompanyId !== "NEW"
        ? user.memberships.find((item) => item.companyId === requestedCompanyId) || null
        : user.memberships.find((item) => item.isDefault) || user.memberships[0] || null;

    if (requestedCompanyId && requestedCompanyId !== "NEW" && !membership && user.companyId !== requestedCompanyId) {
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
      membership?.role || (user.companyId === activeCompanyId ? user.role : null) || user.role;

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
