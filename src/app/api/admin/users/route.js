import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm } from "@/lib/authz";
import bcrypt from "bcryptjs";
import { getCompanyIdFromRequest, requireCompanyId } from "@/lib/tenant";
import { getRequestActor, getRequestRole } from "@/lib/requestAuth";

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

export async function GET(req) {
  const actor = await getRequestActor(req);
  const isPlatformAdmin = actor?.user?.role === "PLATFORM_ADMIN";
  const companyId = isPlatformAdmin ? getCompanyIdFromRequest(req) : requireCompanyId(req);
  const role = await getRequestRole(req, companyId ? { companyId } : {});
  if (!checkPerm("manageUsers", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) {
      return NextResponse.json(
        { error: "companyId invalide (aucune société trouvée)." },
        { status: 400 }
      );
    }
  }
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || 10)));
  const q = url.searchParams.get("q");
  const where = {
    ...(companyId ? { companyId } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, username: true, role: true, createdAt: true, isActive: true, canCreateCompany: true, companyId: true },
    }),
  ]);
  return NextResponse.json({ users, total, page, pageSize });
}

export async function POST(req) {
  const actor = await getRequestActor(req);
  const isPlatformAdmin = actor?.user?.role === "PLATFORM_ADMIN";
  const companyId = isPlatformAdmin ? getCompanyIdFromRequest(req) : requireCompanyId(req);
  const callerRole = await getRequestRole(req, companyId ? { companyId } : {});
  if (!checkPerm("manageUsers", callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) {
      return NextResponse.json(
        { error: "companyId invalide (aucune société trouvée)." },
        { status: 400 }
      );
    }
  }
  const body = await req.json();
  const { username, email, password, role, canCreateCompany } = body || {};
  const normalizedEmail = email?.toString?.().trim().toLowerCase();
  if (!username || !normalizedEmail || !password) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }
  const userRole = normalizeRole(role);
  if (userRole !== "PLATFORM_ADMIN" && !companyId) {
    return NextResponse.json(
      { error: "Sélectionnez une société active avant de créer un utilisateur métier." },
      { status: 400 },
    );
  }
  if (userRole === "PLATFORM_ADMIN" && !isPlatformAdmin) {
    return NextResponse.json({ error: "Seul un PLATFORM_ADMIN peut créer ce rôle." }, { status: 403 });
  }
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });
  if (existing) {
    if (isPlatformAdmin && companyId && userRole !== "PLATFORM_ADMIN") {
      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          username,
          password: hashed,
          role: userRole,
          isActive: true,
          canCreateCompany: !!canCreateCompany,
          companyId: existing.companyId || companyId,
        },
        select: { id: true, email: true, username: true, role: true, createdAt: true, isActive: true, canCreateCompany: true, companyId: true },
      });
      await prisma.companyMembership.upsert({
        where: {
          companyId_userId: {
            companyId,
            userId: user.id,
          },
        },
        update: {
          role: userRole,
          isActive: true,
          isDefault: true,
        },
        create: {
          companyId,
          userId: user.id,
          role: userRole,
          isActive: true,
          isDefault: true,
        },
      });
      return NextResponse.json({ user }, { status: 200 });
    }
    return NextResponse.json({ error: "Email deja utilise" }, { status: 409 });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      companyId: userRole === "PLATFORM_ADMIN" ? null : companyId,
      username,
      email: normalizedEmail,
      password: hashed,
      role: userRole,
      isActive: true,
      canCreateCompany: userRole === "PLATFORM_ADMIN" ? true : isPlatformAdmin ? !!canCreateCompany : false,
      memberships: companyId && userRole !== "PLATFORM_ADMIN"
        ? {
            create: {
              companyId,
              role: userRole,
              isActive: true,
              isDefault: true,
            },
          }
        : undefined,
    },
    select: { id: true, email: true, username: true, role: true, createdAt: true, isActive: true, canCreateCompany: true, companyId: true },
  });
  return NextResponse.json({ user }, { status: 201 });
}
