import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

const allowedRoles = [
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

function checkAdminToken(req) {
  const adminToken = process.env.ADMIN_TOKEN;
  const publicToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  if (!adminToken && !publicToken) return false;
  const header = req.headers.get("x-admin-token");
  return (
    (adminToken && header === adminToken) ||
    (publicToken && header === publicToken)
  );
}

function normalizeRole(role) {
  const upper = role?.toString?.().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return "VIEWER";
  return allowedRoles.includes(upper) ? upper : "VIEWER";
}

// Inscription (signup)
export async function POST(request) {
  const { username, email, password, role } = await request.json();
  if (!username || !email || !password) {
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400 });
  }
  if (!checkAdminToken(request)) {
    return new Response(
      JSON.stringify({ error: "Inscription désactivée. Demandez au SuperAdmin de créer le compte." }),
      { status: 403 }
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return new Response(JSON.stringify({ error: "Email déjà utilisé" }), { status: 409 });
  }
  const hashed = await bcrypt.hash(password, 10);
  const userRole = normalizeRole(role);
  const user = await prisma.user.create({
    data: { username, email, password: hashed, role: userRole },
  });
  return new Response(
    JSON.stringify({ user: { id: user.id, username: user.username, email: user.email, role: user.role } }),
    { status: 201 }
  );
}

// Connexion (signin)
export async function GET(request) {
  const { email, password } = Object.fromEntries(new URL(request.url).searchParams);
  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Champs requis manquants" }), { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return new Response(JSON.stringify({ error: "Identifiants invalides" }), { status: 401 });
  }
  return new Response(
    JSON.stringify({ user: { id: user.id, username: user.username, email: user.email, role: user.role } }),
    { status: 200 }
  );
}
