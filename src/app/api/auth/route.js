import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCompanyIdFromRequest } from "@/lib/tenant";

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
  const { username, email, password } = await request.json();
  if (!username || !email || !password) {
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return new Response(JSON.stringify({ error: "Email déjà utilisé" }), { status: 409 });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashed,
      role: "VIEWER",
      isActive: false,
      canCreateCompany: false,
    },
  });
  return new Response(
    JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        canCreateCompany: user.canCreateCompany,
      },
      message: "Demande d'inscription enregistrée. Un PLATFORM_ADMIN doit approuver votre compte avant connexion.",
    }),
    { status: 201 }
  );
}

// Connexion (signin)
export async function GET(request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { email, password } = params;
  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400 });
  }
  const requestedCompanyId =
    (params.companyId && String(params.companyId).trim()) || getCompanyIdFromRequest(request);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { isActive: true },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!user || !user.password) {
    return new Response(JSON.stringify({ error: "Identifiants invalides" }), { status: 401 });
  }
  if (!(await bcrypt.compare(password, user.password))) {
    return new Response(JSON.stringify({ error: "Identifiants invalides" }), { status: 401 });
  }
  if (!user.isActive) {
    return new Response(
      JSON.stringify({ error: "Compte en attente d'approbation par le PLATFORM_ADMIN." }),
      { status: 403 },
    );
  }
  const membership =
    requestedCompanyId && requestedCompanyId !== "NEW"
      ? user.memberships.find((item) => item.companyId === requestedCompanyId) || null
      : user.memberships.find((item) => item.isDefault) || user.memberships[0] || null;
  if (requestedCompanyId && requestedCompanyId !== "NEW" && !membership && user.companyId !== requestedCompanyId) {
    return new Response(
      JSON.stringify({ error: "Accès refusé à cette société pour cet utilisateur" }),
      { status: 403 }
    );
  }
  const activeCompanyId =
    requestedCompanyId === "NEW"
      ? "NEW"
      : membership?.companyId || (user.companyId === requestedCompanyId ? requestedCompanyId : user.companyId) || null;
  const activeRole =
    membership?.role || (user.companyId === activeCompanyId ? user.role : null) || user.role;
  return new Response(
    JSON.stringify({
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
    }),
    { status: 200 }
  );
}
