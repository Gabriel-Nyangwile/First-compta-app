import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkPerm, getUserRole } from "@/lib/authz";
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

function normalizeRole(role) {
  const upper = role?.toString?.().toUpperCase().replace(/[\s-]+/g, "_");
  if (!upper) return "VIEWER";
  return allowedRoles.includes(upper) ? upper : "VIEWER";
}

export async function GET(req) {
  const role = await getUserRole(req);
  if (!checkPerm("manageUsers", role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, username: true, role: true, createdAt: true, isActive: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req) {
  const callerRole = await getUserRole(req);
  if (!checkPerm("manageUsers", callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { username, email, password, role } = body || {};
  if (!username || !email || !password) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
  }
  const hashed = await bcrypt.hash(password, 10);
  const userRole = normalizeRole(role);
  const user = await prisma.user.create({
    data: { username, email, password: hashed, role: userRole },
    select: { id: true, email: true, username: true, role: true, createdAt: true, isActive: true },
  });
  return NextResponse.json({ user }, { status: 201 });
}
